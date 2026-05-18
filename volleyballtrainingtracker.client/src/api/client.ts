import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

// 本機開發：VITE_API_URL 留空，baseURL = '/api'，由 Vite dev proxy 轉發到本機後端。
// 正式部署（Vercel）：設定 VITE_API_URL 為 Render 後端網址（結尾不加斜線），
//   例如 https://vbtt-api.onrender.com → baseURL = 'https://vbtt-api.onrender.com/api'。
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
