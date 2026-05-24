import axios from 'axios';
import { useAuthStore } from '../store/auth';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    const message = err.response?.data?.error?.message || err.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  },
);

export default api;
