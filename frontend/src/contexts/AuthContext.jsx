import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchMe, logoutApi } from '../api';
import { tokenStore } from '../api/index';
import { socket } from '../socket';
import { BounceLoader } from 'react-spinners';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  // ✅ FIX: Token endi in-memory (tokenStore) da — localStorage emas.
  // User ma'lumotlari (ism, rol) localStorage'da qoladi — bu xavfsiz.
  // Sahifa yangilanganda token yo'q → /api/auth/refresh → yangi token olinadi.
  const cachedUserStr = localStorage.getItem('crm_user');
  
  let initialUser = null;
  if (cachedUserStr) {
    try {
      initialUser = JSON.parse(cachedUserStr);
    } catch (e) {
      // ignore parse errors
    }
  }

  const [user, setUser] = useState(initialUser);
  // Sahifa yangilanganda har doim refresh so'rov yuboriladi (token yo'q bo'lgani uchun)
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      // Agar keshda user bo'lsa darhol socket ni ulaymiz (optimistic)
      if (initialUser) {
        socket.connect();
      }

      try {
        // Sahifa yangilanganda /api/auth/refresh orqali yangi access token olamiz
        // Bu HttpOnly cookie orqali ishlaydi — CSRF xavfi yo'q (SameSite=none/lax)
        const { default: api } = await import('../api/index');
        const refreshRes = await api.post('/auth/refresh');
        const newToken = refreshRes.data?.data?.token;
        if (newToken) {
          tokenStore.set(newToken);
        }

        // /me endpoint bilan foydalanuvchi ma'lumotlarini yangilash
        const res = await fetchMe();
        if (res.success) {
          setUser(res.data);
          localStorage.setItem('crm_user', JSON.stringify(res.data));
          if (!initialUser) socket.connect();
        } else {
          localStorage.removeItem('crm_user');
          tokenStore.clear();
          setUser(null);
          socket.disconnect();
        }
      } catch {
        // Refresh muvaffaqiyatsiz — foydalanuvchi login sahifasiga ketadi
        localStorage.removeItem('crm_user');
        tokenStore.clear();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (userData, token) => {
    tokenStore.set(token); // ✅ In-memory token
    localStorage.setItem('crm_user', JSON.stringify(userData));
    setUser(userData);
    socket.connect();
  };

  /**
   * logout — access token'ni xotiradan, refresh token'ni
   * server orqali HttpOnly cookie'dan tozalaydi.
   */
  const logout = async () => {
    try {
      await logoutApi(); // Server cookie'sini tozalaydi
    } catch {
      // Agar server xatosi bo'lsa ham local state'ni tozalaymiz
    } finally {
      tokenStore.clear();
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
