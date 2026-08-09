import React, { useState, Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import BottomNavigation from './components/BottomNavigation';
import CartDrawer from './components/CartDrawer';
import TransferCartDrawer from './components/TransferCartDrawer';
import PwaInstallBanner from './components/PwaInstallBanner';
import PwaUpdater from './components/PwaUpdater';
import PushNotificationBanner from './components/PushNotificationBanner';

// Custom lazy load wrapper to handle chunk loading errors after new deployments
const lazyLoad = (importFunc) => lazy(() => 
  importFunc().catch((error) => {
    console.error('Dynamic import error:', error);
    const isChunkLoadFailed = error.message.includes('Failed to fetch dynamically imported module') || 
                              error.message.includes('Importing a module script failed');
    if (isChunkLoadFailed) {
      const hasRetried = window.sessionStorage.getItem('chunk-retry');
      if (!hasRetried) {
        window.sessionStorage.setItem('chunk-retry', 'true');
        // Keshni tozalab keyin reload qilamiz
        if ('caches' in window) {
          caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
            .finally(() => window.location.reload());
        } else {
          window.location.reload();
        }
      } else {
        window.sessionStorage.removeItem('chunk-retry');
      }
    }
    throw error;
  }).then((module) => {
    window.sessionStorage.removeItem('chunk-retry');
    return module;
  })
);

const Dashboard = lazyLoad(() => import('./pages/Dashboard'));
const ProductsPage = lazyLoad(() => import('./pages/ProductsPage'));
const ReplenishmentPage = lazyLoad(() => import('./pages/ReplenishmentPage'));
const OrdersPage = lazyLoad(() => import('./pages/OrdersPage'));
const CustomersPage = lazyLoad(() => import('./pages/CustomersPage'));
const DebtPage = lazyLoad(() => import('./pages/DebtPage'));
const WarehousesPage = lazyLoad(() => import('./pages/WarehousesPage'));
const LoginPage = lazyLoad(() => import('./pages/LoginPage'));
const AIAnalyticsPage = lazyLoad(() => import('./pages/AIAnalyticsPage'));
const ReportsPage = lazyLoad(() => import('./pages/ReportsPage'));
const SettingsPage = lazyLoad(() => import('./pages/SettingsPage'));
const AuditLogPage = lazyLoad(() => import('./pages/AuditLogPage'));
const EmployeesPage = lazyLoad(() => import('./pages/EmployeesPage'));
const QuickReturnPage = lazyLoad(() => import('./pages/QuickReturnPage'));
const TransfersPage = lazyLoad(() => import('./pages/TransfersPage'));
const SystemHealthPage = lazyLoad(() => import('./pages/SystemHealthPage'));

import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { useCurrentShift } from './hooks/useShifts';
import { useShiftEnabled } from './hooks/useSettings';
import { useSocketConnection } from './hooks/useSocket';
import ShiftModal from './components/ShiftModal';
import { Toaster } from 'react-hot-toast';
import { BounceLoader } from 'react-spinners';
import OnboardingTour from './components/OnboardingTour';

// ─── ShiftGuard — smena tizimi yoqilgan bo'lsagina ishlaydi ─────────────────
// shiftEnabled = false → smena tekshiruvi yo'q, foydalanuvchi to'g'ri o'tadi
// shiftEnabled = true  → smena ochilmagan bo'lsa — ShiftModal avtomatik ochiladi
const ShiftGuard = ({ children }) => {
  const { shiftEnabled, isLoading: settingsLoading } = useShiftEnabled();
  const { data: shiftRes, isLoading: shiftLoading } = useCurrentShift({
    enabled: shiftEnabled, // Smena o'chirilgan bo'lsa query umuman yuborilmaydi
  });

  // Settings yuklanguncha kutilamiz (odatda cache'dan darhol keladi)
  if (settingsLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center h-full gap-4">
      <BounceLoader color="var(--accent-primary)" size={45} />
      <span className="text-13 text-secondary animate-pulse font-[500]">Yuklanmoqda...</span>
    </div>
  );

  // Smena tizimi o'chirilgan — to'g'ri o'tkazamiz
  if (!shiftEnabled) {
    return <>{children}</>;
  }

  // Smena tizimi yoqilgan — shift yuklanguncha kutamiz
  if (shiftLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center h-full gap-4">
      <BounceLoader color="var(--accent-primary)" size={45} />
      <span className="text-13 text-secondary animate-pulse font-[500]">Yuklanmoqda...</span>
    </div>
  );

  const currentShift = shiftRes?.data;

  return (
    <>
      {children}
      {!currentShift && <ShiftModal isOpen={true} mode="start" />}
    </>
  );
};

// Layout component for authenticated routes
const AuthenticatedLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useSocketConnection();

  return (
    <div className="flex h-[100dvh] bg-app text-primary overflow-hidden relative flex-col md:flex-row p-safe">
      {/* Mobile Sidebar Backdrop (Smooth Transition) */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 md:hidden backdrop-transition ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Mobile Top Bar */}
        <header className="h-14 border-b border-subtle bg-surface flex items-center justify-between px-3 md:hidden shrink-0 z-30 relative shadow-sm">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle active:bg-raised active:scale-95 rounded-xl transition-all duration-200"
            >
              <Menu className="w-[20px] h-[20px]" strokeWidth={1.5} />
            </button>
            <img src="/logo.png" alt="Logo" className="w-[20px] h-[20px] object-contain ml-1" />
            <span className="text-[15px] font-[600] tracking-tight text-primary ml-1">FERGANA OBOI</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-app relative pb-16 md:pb-0">
          <ShiftGuard>
            {children}
          </ShiftGuard>
        </main>

        <OnboardingTour />
        <BottomNavigation />
        <CartDrawer />
        <TransferCartDrawer />
      </div>
    </div>
  );
};

import { TransferProvider } from './contexts/TransferContext';

const AuthEventHandler = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const handleAuthExpired = () => {
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [navigate]);
  return null;
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <TransferProvider>
          {/* Global audio element for reliable playback */}
          <audio id="notification-sound" src="/sound.mp3" preload="auto" style={{ display: 'none' }}></audio>
          
          <Router>
            <AuthEventHandler />
          <ErrorBoundary>
          <Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center h-[100dvh] w-full gap-4 bg-app">
              <BounceLoader color="var(--accent-primary)" size={45} />
              <span className="text-[13px] text-secondary animate-pulse font-[500]">Yuklanmoqda...</span>
            </div>
          }>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<LoginPage />} />
              
              <Route path="/sys-monitor" element={
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-screen bg-[#0f172a]">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }>
                  <SystemHealthPage />
                </Suspense>
              } />


              {/* Protected Routes wrapped in AuthenticatedLayout */}
              <Route path="/" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <Navigate to="/dashboard" replace />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <AuthenticatedLayout>
                    <Dashboard />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/warehouses" element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'manager']}>
                  <AuthenticatedLayout>
                    <WarehousesPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/products" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <ProductsPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/replenishment" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <ReplenishmentPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/orders" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <OrdersPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/customers" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <CustomersPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/debts" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <DebtPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/quick-return" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <QuickReturnPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />

              <Route path="/transfers" element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <TransfersPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />

              <Route path="/ai-analytics" element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin', 'manager']}>
                  <AuthenticatedLayout>
                    <AIAnalyticsPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />

              <Route path="/reports" element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <AuthenticatedLayout>
                    <ReportsPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <AuthenticatedLayout>
                    <SettingsPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />

              <Route path="/audit-logs" element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <AuthenticatedLayout>
                    <AuditLogPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />

              <Route path="/employees" element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <AuthenticatedLayout>
                    <EmployeesPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } />

            </Routes>
          </Suspense>
          </ErrorBoundary>

          <Toaster 
            position="top-center"
            toastOptions={{
              style: {
                background: 'var(--bg-overlay)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: '"Space Grotesk", sans-serif',
                padding: '10px 14px',
                boxShadow: 'none',
                maxWidth: '360px',
              },
              success: {
                iconTheme: { primary: '#166534', secondary: '#F0FAF4' },
                duration: 3000,
              },
              error: {
                iconTheme: { primary: '#991B1B', secondary: '#FEF2F2' },
                duration: 4000,
              },
            }}
          />
          <PwaInstallBanner />
          <PwaUpdater />
          <PushNotificationBanner />
        </Router>
        </TransferProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
