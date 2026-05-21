import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

// 本機開發：VITE_API_URL 留空，baseURL = '/api'，由 Vite dev proxy 轉發到本機後端。
// 正式部署（Vercel）：設定 VITE_API_URL 為 Render 後端網址（結尾不加斜線），
//   例如 https://vbtt-api.onrender.com → baseURL = 'https://vbtt-api.onrender.com/api'。
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  headers: { 'Content-Type': 'application/json' },
  // 後端（Render 免費方案）休眠後 cold start 可能需 30–60 秒，逾時放寬到 90 秒，
  // 避免在喚醒過程中誤判為失敗。
  timeout: 90_000,
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
    } else if (!err?.response) {
      // 沒有 HTTP 回應：逾時、網路中斷，或後端 cold start 尚未喚醒完成。
      const isTimeout = err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message ?? '');
      err.friendlyMessage = isTimeout
        ? '伺服器喚醒逾時，可能正在從休眠中啟動，請稍候再試一次。'
        : '無法連線到伺服器，請檢查網路後再試一次。';
    }
    return Promise.reject(err);
  }
);

/** 從 API 錯誤取出可顯示給使用者的訊息（優先後端訊息，其次連線友善訊息）。 */
export function getApiErrorMessage(err: unknown, fallback = '操作失敗'): string {
  const e = err as { response?: { data?: { message?: string } }; friendlyMessage?: string };
  return e?.response?.data?.message ?? e?.friendlyMessage ?? fallback;
}
