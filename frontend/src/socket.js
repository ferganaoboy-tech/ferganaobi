import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
const URL = import.meta.env.VITE_API_URL ? API_URL.replace(/\/api\/?$/, '') : (import.meta.env.DEV ? 'http://localhost:5000' : '');

export const socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  auth: (cb) => {
    cb({ token: localStorage.getItem('crm_token') });
  }
});
