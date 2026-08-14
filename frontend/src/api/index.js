import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // HttpOnly cookie (refresh token) yuborish uchun
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Har bir so'rovga access token'ni qo'shish
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// 401 → refresh token bilan yangi access token olish, so'rovni qayta yuborish

let isRefreshing = false;
let failedQueue = []; // Refresh davomida kelgan so'rovlarni saqlash
let lastNetworkErrorToast = 0;

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Tarmoq xatosi
    if (error.message === 'Network Error' && !error.response) {
      const now = Date.now();
      if (now - lastNetworkErrorToast > 10000) {
        lastNetworkErrorToast = now;
        import('react-hot-toast').then(({ default: toast }) => {
          toast.error("Tarmoq xatosi: Server bilan ulanish yo'q", { 
            id: 'network-error',
            duration: 4000
          });
        });
      }
      return Promise.reject(error);
    }

    // 401 — Token muddati o'tgan yoki noto'g'ri
    if (error.response?.status === 401 && !originalRequest._retry) {
      // /refresh endpoint o'zi 401 qaytarsa — login sahifasiga yo'naltir
      if (originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        window.dispatchEvent(new Event('auth:expired'));
        return Promise.reject(error);
      }

      // Bir vaqtda bir nechta so'rov kelsa — birinchisi refresh qiladi,
      // qolganlar navbatda kutadi (failedQueue)
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // HttpOnly cookie orqali refresh token yuboriladi (withCredentials: true)
        const refreshRes = await api.post('/auth/refresh');
        const newToken = refreshRes.data?.data?.token;

        if (!newToken) throw new Error('No token in refresh response');

        localStorage.setItem('crm_token', newToken);

        // Agar user ma'lumotlari ham yangilangan bo'lsa
        if (refreshRes.data?.data?.user) {
          localStorage.setItem('crm_user', JSON.stringify(refreshRes.data.data.user));
        }

        // Navbatdagi so'rovlarni yangi token bilan davom ettirish
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh ham muvaffaqiyatsiz — foydalanuvchini login sahifasiga yo'naltir
        processQueue(refreshError, null);
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        window.dispatchEvent(new Event('auth:expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

const extractData = (response) => response.data;

// ─── Products API ─────────────────────────────────────────────────────────────
export const fetchProducts    = (params) => api.get('/products', { params }).then(extractData);
export const compareProducts  = (artikul, brand) => api.get('/products/compare', { params: { artikul, brand } }).then(extractData);
export const getReplenishmentRecommendations = (warehouseId) => api.get('/products/replenishment', { params: { warehouseId } }).then(extractData);
export const fetchProduct     = (id)     => api.get(`/products/${id}`).then(extractData);
export const createProduct    = (formData) => api.post('/products', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
}).then(extractData);
export const updateProduct    = ({ id, data }) => api.put(`/products/${id}`, data, {
  headers: { 'Content-Type': 'multipart/form-data' },
}).then(extractData);
export const deleteProduct    = (id)     => api.delete(`/products/${id}`).then(extractData);
export const fetchProductFilters   = ()  => api.get('/products/filters').then(extractData);
export const fetchDashboardStats   = ()  => api.get('/products/stats/dashboard').then(extractData);

// ─── Warehouses API ───────────────────────────────────────────────────────────
export const fetchWarehouses  = (params)      => api.get('/warehouses', { params }).then(extractData);
export const createWarehouse  = (data)        => api.post('/warehouses', data).then(extractData);
export const updateWarehouse  = ({ id, data }) => api.put(`/warehouses/${id}`, data).then(extractData);
export const deleteWarehouse  = (id)          => api.delete(`/warehouses/${id}`).then(extractData);

// ─── Customers API ────────────────────────────────────────────────────────────
export const fetchCustomers   = (params)      => api.get('/customers', { params }).then(extractData);
export const fetchDebtors     = ()            => api.get('/customers/debtors').then(extractData);
export const createCustomer   = (data)        => api.post('/customers', data).then(extractData);
export const updateCustomer   = ({ id, data }) => api.put(`/customers/${id}`, data).then(extractData);
export const deleteCustomer   = (id)          => api.delete(`/customers/${id}`).then(extractData);

// ─── Orders API ───────────────────────────────────────────────────────────────
export const fetchOrders      = (params) => api.get('/orders', { params }).then(extractData);
export const fetchOrderStats  = ()       => api.get('/orders/stats').then(extractData);
export const createOrder      = (data)   => api.post('/orders', data).then(extractData);
export const confirmOrder     = (id)     => api.put(`/orders/${id}/confirm`).then(extractData);
export const deliverOrder     = (id)     => api.put(`/orders/${id}/deliver`, { status: 'delivered' }).then(extractData);
export const cancelOrder      = (id)     => api.put(`/orders/${id}/cancel`).then(extractData);
export const sendOrderReceiptToTelegram = (id, imageBase64) => api.post(`/orders/${id}/send-receipt`, { imageBase64 }).then(extractData);

// ─── Payments API ─────────────────────────────────────────────────────────────
export const fetchPayments    = (params) => api.get('/payments', { params }).then(extractData);
export const createPayment    = (data)   => api.post('/payments', data).then(extractData);

// ─── Returns API ──────────────────────────────────────────────────────────────
export const fetchReturns     = (params) => api.get('/returns', { params }).then(extractData);
export const createReturn     = (data)   => api.post('/returns', data).then(extractData);
export const createQuickReturn = (data)  => api.post('/returns/quick', data).then(extractData);

// ─── Settings API ─────────────────────────────────────────────────────────────
export const fetchSettings    = ()     => api.get('/settings').then(extractData);
export const updateSettings   = (data) => api.put('/settings', data).then(extractData);

// ─── Shifts API ───────────────────────────────────────────────────────────────
export const fetchCurrentShift = ()     => api.get('/shifts/current').then(extractData);
export const startShift        = (data) => api.post('/shifts/start', data).then(extractData);
export const closeShift        = (data) => api.post('/shifts/close', data).then(extractData);

// ─── Audit Logs API ───────────────────────────────────────────────────────────
export const fetchAuditLogs   = (params) => api.get('/audit-logs', { params }).then(extractData);

// ─── Users (Employees) API ────────────────────────────────────────────────────
export const fetchUsers   = ()          => api.get('/users').then(extractData);
export const createUser   = (data)      => api.post('/users', data).then(extractData);
export const updateUser   = (id, data)  => api.put(`/users/${id}`, data).then(extractData);
export const deleteUser   = (id)        => api.delete(`/users/${id}`).then(extractData);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const login        = (data) => api.post('/auth/login', data).then(extractData);
export const loginPin     = (data) => api.post('/auth/login-pin', data).then(extractData);
export const fetchMe      = ()     => api.get('/auth/me').then(extractData);
export const logoutApi    = ()     => api.post('/auth/logout').then(extractData);

// ─── System / Admin API ───────────────────────────────────────────────────────
export const getDbStats          = ()  => api.get('/settings/db-stats').then(extractData);
export const clearDomain         = (data) => api.post('/settings/clear-domain', data).then(extractData);
export const exportFullBackup    = ()  => api.get('/export/full-backup', { responseType: 'blob' });
export const exportFullBackupJson = ()  => api.get('/export/full-backup-json', { responseType: 'blob' });
export const recalculateDebts    = ()  => api.post('/customers/recalculate-debts').then(extractData);
export const sendDailyReportTelegram = () => api.post('/reports/send-daily').then(extractData);

export default api;
