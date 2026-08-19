import { io } from 'socket.io-client';
import { tokenStore } from './api/index';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
const URL = import.meta.env.VITE_API_URL ? API_URL.replace(/\/api\/?$/, '') : (import.meta.env.DEV ? 'http://localhost:5000' : '');

export const socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  auth: (cb) => {
    // ✅ FIX: localStorage o'rniga in-memory tokenStore — XSS himoyasi
    cb({ token: tokenStore.get() });
  }
});

