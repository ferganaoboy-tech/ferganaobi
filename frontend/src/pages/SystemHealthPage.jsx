import React, { useState, useEffect } from 'react';
import { useSystemHealth, useSystemAiDiagnostics } from '../hooks/useSystemHealth';
import { Lock, Server, Database, HardDrive, Cpu, Activity, Clock, Users, ArrowLeft, Bot, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

const formatUptime = (seconds) => {
  const d = Math.floor(seconds / (3600*24));
  const h = Math.floor(seconds % (3600*24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  
  const dDisplay = d > 0 ? d + " kun, " : "";
  const hDisplay = h > 0 ? h + " soat, " : "";
  const mDisplay = m > 0 ? m + " daq, " : "";
  const sDisplay = s > 0 ? s + " soniya" : "";
  return dDisplay + hDisplay + mDisplay + sDisplay;
};

const SystemHealthPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [attemptedPassword, setAttemptedPassword] = useState('');
  const [isAiRequested, setIsAiRequested] = useState(false);

  // Session storage check
  useEffect(() => {
    const savedToken = sessionStorage.getItem('monitorToken');
    if (savedToken) {
      setAttemptedPassword(savedToken);
      setIsUnlocked(true);
    }
  }, []);

  const { data, isLoading, isError, error } = useSystemHealth(attemptedPassword, isUnlocked);
  const { data: aiData, isLoading: aiLoading, isError: aiIsError, error: aiError } = useSystemAiDiagnostics(attemptedPassword, isUnlocked, isAiRequested);

  useEffect(() => {
    if (isError && error?.response?.status === 401) {
      toast.error('Parol noto\'g\'ri!');
      setIsUnlocked(false);
      sessionStorage.removeItem('monitorToken');
      setAttemptedPassword('');
    }
  }, [isError, error]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!password) return;
    setAttemptedPassword(password);
    setIsUnlocked(true);
    sessionStorage.setItem('monitorToken', password);
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Orqaga
        </button>
        <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-700/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-700">
            <Lock className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white text-center mb-2">Monitor Access</h1>
          <p className="text-slate-400 text-sm text-center mb-6">Tizim holatini ko'rish uchun maxfiy parolni kiriting</p>
          
          <form onSubmit={handleUnlock} className="space-y-4">
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-center tracking-widest"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)]"
            >
              Qulfdan chiqarish
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError && error?.response?.status !== 401) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white">
        <Server className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Xatolik yuz berdi</h2>
        <p className="text-slate-400 mt-2">{error?.message || "Server bilan ulanib bo'lmadi"}</p>
        <button 
          onClick={() => { setIsUnlocked(false); sessionStorage.removeItem('monitorToken'); }} 
          className="mt-6 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
        >
          Orqaga qaytish
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#0f172a] text-slate-200 p-4 sm:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button 
                onClick={() => navigate('/')}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors mr-2"
              >
                <ArrowLeft className="w-4 h-4 text-slate-300" />
              </button>
              <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
              <h1 className="text-3xl font-bold text-white tracking-tight">System Monitor</h1>
            </div>
            <p className="text-slate-400 text-sm ml-14">Haqiqiy vaqt (Real-time) dagi tizim ko'rsatkichlari (Har 5 soniyada yangilanadi)</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-400 text-sm font-medium">Tizim barqaror</span>
          </div>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Uptime Card */}
          <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Clock className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Uptime (Faollik)</p>
                <p className="text-white font-bold text-[15px]">{formatUptime(data.server.uptimeSeconds)}</p>
              </div>
            </div>
          </div>

          {/* Active Connections Card */}
          <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Jonli Ulanishlar</p>
                <div className="flex items-end gap-2">
                  <p className="text-white font-bold text-2xl leading-none">{data.connections.activeSockets}</p>
                  <p className="text-blue-400 text-sm mb-0.5">qurilma</p>
                </div>
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                <Database className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">MongoDB Holati</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${data.database.status === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <p className="text-white font-bold text-lg leading-none">{data.database.status}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Database Size */}
          <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group">
             <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                <HardDrive className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Baza Hajmi (MB)</p>
                <div className="flex items-end gap-2">
                  <p className="text-white font-bold text-2xl leading-none">{data.database.dataSizeMB}</p>
                  <p className="text-amber-400 text-sm mb-0.5">MB</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Memory Usage */}
          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-lg p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-6">
              <Server className="w-5 h-5 text-fuchsia-400" /> Xotira (RAM) Ko'rsatkichlari
            </h2>
            
            <div className="space-y-6">
              {/* RAM Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Server Umumiy Xotira Bandligi</span>
                  <span className="text-white font-medium">{data.memory.osUsagePercent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full ${data.memory.osUsagePercent > 85 ? 'bg-red-500' : data.memory.osUsagePercent > 70 ? 'bg-amber-500' : 'bg-fuchsia-500'}`} 
                    style={{ width: `${data.memory.osUsagePercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-xs uppercase mb-1">Backend Dastur (Node.js)</p>
                  <p className="text-2xl font-bold text-white">{data.memory.processRss} <span className="text-sm text-slate-500">MB</span></p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-xs uppercase mb-1">Bo'sh xotira (Free)</p>
                  <p className="text-2xl font-bold text-white">{data.memory.osFree} <span className="text-sm text-slate-500">MB</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Server Info */}
          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-lg p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-6">
              <Cpu className="w-5 h-5 text-cyan-400" /> CPU va Tizim Ma'lumotlari
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Hostname</span>
                <span className="text-white font-mono bg-slate-800 px-2 py-1 rounded">{data.server.hostname}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Platforma (OS)</span>
                <span className="text-white capitalize">{data.server.platform}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400">Jami Ma'lumotlar Soni (DB Objects)</span>
                <span className="text-white font-medium">{data.database.objectsCount.toLocaleString('ru-RU')} ta record</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-slate-400">Load Average (1, 5, 15 daq)</span>
                <div className="flex gap-2">
                  {data.server.loadAvg.map((load, i) => (
                    <span key={i} className="text-xs font-mono bg-slate-800 text-cyan-400 px-2 py-1 rounded">{load}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Diagnostics Section */}
        <div className="mt-8 bg-[#1e293b]/80 backdrop-blur-md rounded-3xl border border-slate-700/50 p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Bot className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">AI Diagnostika</h2>
                <p className="text-slate-400 text-sm">Tizim holati bo'yicha Senior DevOps xulosasi</p>
              </div>
            </div>
            {!isAiRequested && (
              <button 
                onClick={() => setIsAiRequested(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)]"
              >
                <Sparkles className="w-5 h-5" />
                Tahlil qilish
              </button>
            )}
          </div>

          {isAiRequested && (
            <div className="bg-[#0f172a] rounded-2xl p-6 border border-slate-700 relative overflow-hidden min-h-[200px]">
              {aiLoading || !aiData && !aiIsError ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4 absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm z-10">
                  <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-purple-400 font-medium animate-pulse">AI tizimni o'qimoqda va tahlil qilmoqda... (10-15 soniya kutishingiz mumkin)</p>
                </div>
              ) : aiIsError ? (
                <div className="text-center text-red-400 p-4">
                  <p>Xatolik yuz berdi: {aiError?.message}</p>
                  <button onClick={() => setIsAiRequested(false)} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-white">Yopish</button>
                </div>
              ) : aiData ? (
                <div className="prose prose-invert prose-purple max-w-none prose-headings:mb-2 prose-p:text-slate-300 prose-li:text-slate-300">
                  <ReactMarkdown>{aiData}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center text-slate-400 p-4">
                  <p>Kutilmagan holat yuz berdi. Ma'lumot topilmadi.</p>
                  <button onClick={() => setIsAiRequested(false)} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-white">Yopish</button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SystemHealthPage;
