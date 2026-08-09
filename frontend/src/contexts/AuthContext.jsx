import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchMe, logoutApi } from '../api';
import { socket } from '../socket';
import { BounceLoader } from 'react-spinners';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const cachedToken = localStorage.getItem('crm_token');
  const cachedUserStr = localStorage.getItem('crm_user');
  
  let initialUser = null;
  if (cachedToken && cachedUserStr) {
    try {
      initialUser = JSON.parse(cachedUserStr);
    } catch (e) {
      // ignore parse errors
    }
  }

  const [user, setUser] = useState(initialUser);
  // Agar keshda yuzer bo'lsa, kutishga hojat yo'q - darhol render qilamiz
  const [isLoading, setIsLoading] = useState(!initialUser && !!cachedToken);

  useEffect(() => {
    const loadUser = async () => {
      if (!cachedToken) {
        setIsLoading(false);
        return;
      }

      // Agar keshda user bo'lsa darhol socket ni ulaymiz
      if (initialUser) {
        socket.connect();
      }

      try {
        const res = await fetchMe();
        if (res.success) {
          setUser(res.data);
          localStorage.setItem('crm_user', JSON.stringify(res.data));
          if (!initialUser) socket.connect();
        } else {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_user');
          setUser(null);
        }
      } catch {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [cachedToken]);

  const login = (userData, token) => {
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(userData));
    setUser(userData);
    socket.connect();
  };

  /**
   * logout — access token'ni localStorage'dan, refresh token'ni
   * server orqali HttpOnly cookie'dan tozalaydi.
   */
  const logout = async () => {
    try {
      await logoutApi(); // Server cookie'sini tozalaydi
    } catch {
      // Agar server xatosi bo'lsa ham local state'ni tozalaymiz
    } finally {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      setUser(null);
      if (socket.connected) {
        socket.disconnect();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] w-full gap-4 bg-app">
        <BounceLoader color="var(--accent-primary)" size={45} />
        <span className="text-[13px] text-secondary animate-pulse font-[500]">Yuklanmoqda...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
