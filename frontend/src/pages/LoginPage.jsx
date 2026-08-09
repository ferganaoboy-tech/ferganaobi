import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login as apiLogin, loginPin as apiLoginPin } from '../api';
import toast from 'react-hot-toast';
import { Delete, RefreshCw } from 'lucide-react';
import PullToRefresh from '../components/PullToRefresh';

const LoginPage = () => {
  const [pin, setPin] = useState('');
  const [useAdminLogin, setUseAdminLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  // PIN pad configuration
  const PIN_LENGTH = 4;

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      handlePinSubmit();
    }
  }, [pin]);

  const handlePinSubmit = async () => {
    setIsLoading(true);
    try {
      const res = await apiLoginPin({ pin });
      if (res.success) {
        login(res.data.user, res.data.token);
        toast.success("Tizimga muvaffaqiyatli kirdingiz");
        navigate(from, { replace: true });
      } else {
        triggerError();
      }
    } catch (error) {
      triggerError();
    } finally {
      setIsLoading(false);
    }
  };

  const triggerError = () => {
    setErrorShake(true);
    setTimeout(() => {
      setErrorShake(false);
      setPin('');
    }, 500);
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await apiLogin({ username, password });
      if (res.success) {
        login(res.data.user, res.data.token);
        navigate(from, { replace: true });
      } else {
        toast.error(res.message || "Login yoki parol xato!");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Tizimga kirishda xatolik yuz berdi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumClick = (e, num) => {
    if (e) e.preventDefault(); // Prevent double firing
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num);
      // Haptic feedback for native feel (faqat user ekranga tekkandan keyin)
      if (window.navigator && window.navigator.vibrate && navigator.userActivation?.hasBeenActive) {
        window.navigator.vibrate(15);
      }
    }
  };

  const handleDelete = (e) => {
    if (e) e.preventDefault();
    setPin(prev => prev.slice(0, -1));
    if (window.navigator && window.navigator.vibrate && navigator.userActivation?.hasBeenActive) {
      window.navigator.vibrate(15);
    }
  };

  const inputClass = "w-full h-[54px] bg-surface border border-subtle focus:border-focus focus:shadow-[0_0_0_3px_var(--bg-subtle)] rounded-[16px] px-5 text-[16px] text-primary outline-none transition-all duration-200 font-medium";

  return (
    <PullToRefresh onRefresh={() => {
      // Force reload to trigger SW update check
      return new Promise(resolve => {
        setTimeout(() => {
          window.location.reload(true);
          resolve();
        }, 600);
      });
    }}>
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-app text-primary font-sans antialiased relative">
        
        {/* Static Refresh Button for Manual Reload */}
        <button 
          onClick={() => window.location.reload(true)}
          className="absolute top-6 right-6 p-2.5 rounded-full bg-surface border border-subtle shadow-sm text-secondary hover:text-primary active:scale-95 transition-all z-50"
          title="Ilovani yangilash"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        <div className="w-full max-w-[340px] flex flex-col items-center relative">
        
        {/* Logo and Title */}
        <div className="mb-6 flex flex-col items-center animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out">
          <div className="w-[72px] h-[72px] mb-3 rounded-[20px] shadow-sm flex items-center justify-center overflow-hidden border border-subtle bg-surface">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
          </div>
          <h1 className="text-[22px] font-[600] tracking-tight text-primary">FERGANA OBOI</h1>
          <p className="text-[14px] text-secondary mt-1 font-[500] tracking-wide">
            {useAdminLogin ? 'Tizimga kirish' : 'Terminalga kiring'}
          </p>
        </div>

        {!useAdminLogin ? (
          <div className="flex flex-col items-center w-full animate-in fade-in zoom-in-[0.98] duration-300">
            {/* PIN Dots (iOS Hollow/Filled circles) */}
            <div className={`flex gap-[20px] mb-8 h-4 items-center justify-center ${errorShake ? 'animate-shake' : ''}`}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-[14px] h-[14px] rounded-full transition-all duration-200 ${
                    i < pin.length 
                      ? 'bg-primary scale-100' 
                      : 'bg-transparent border-[1.5px] border-tertiary scale-90'
                  }`}
                />
              ))}
            </div>

            {/* Numpad (iOS Circular Buttons) */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-[260px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onPointerDown={(e) => handleNumClick(e, num.toString())}
                  disabled={isLoading}
                  className="w-[70px] h-[70px] rounded-full bg-surface border border-subtle shadow-sm hover:bg-raised flex items-center justify-center text-[28px] font-[400] text-primary transition-all duration-75 active:scale-95 disabled:opacity-50 select-none touch-manipulation"
                >
                  {num}
                </button>
              ))}
              <div className="w-[70px] h-[70px]"></div> {/* Empty space */}
              <button
                onPointerDown={(e) => handleNumClick(e, '0')}
                disabled={isLoading}
                className="w-[70px] h-[70px] rounded-full bg-surface border border-subtle shadow-sm hover:bg-raised flex items-center justify-center text-[28px] font-[400] text-primary transition-all duration-75 active:scale-95 disabled:opacity-50 select-none touch-manipulation"
              >
                0
              </button>
              <button
                onPointerDown={handleDelete}
                disabled={isLoading || pin.length === 0}
                className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-raised transition-all duration-75 active:scale-95 disabled:opacity-0 select-none touch-manipulation"
              >
                <Delete className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </div>

            {isLoading && (
              <p className="text-[14px] text-tertiary mt-8 animate-pulse font-medium">Tekshirilmoqda...</p>
            )}

            <button 
              onClick={() => setUseAdminLogin(true)}
              className="mt-8 text-[14px] font-[600] text-accent hover:text-accent-hover active:opacity-70 transition-all"
            >
              Parol bilan kirish
            </button>
          </div>
        ) : (
          <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <input 
                  required 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className={inputClass}
                  placeholder="Login"
                  autoComplete="username"
                />
              </div>
              
              <div>
                <input 
                  required 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className={inputClass}
                  placeholder="Parol"
                  autoComplete="current-password"
                />
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-[54px] mt-2 bg-accent text-inverse rounded-[16px] text-[16px] font-[600] hover:bg-accent-hover transition-all disabled:opacity-50 active:scale-[0.98] shadow-md"
              >
                {isLoading ? 'Kirilmoqda...' : 'Kirish'}
              </button>
            </form>
            
            <button 
              onClick={() => {
                setUseAdminLogin(false);
                setPin('');
              }}
              className="w-full mt-8 text-[15px] font-[600] text-accent hover:text-accent-hover active:opacity-70 transition-all text-center"
            >
              Terminal orqali kirish
            </button>
          </div>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
};

export default LoginPage;
