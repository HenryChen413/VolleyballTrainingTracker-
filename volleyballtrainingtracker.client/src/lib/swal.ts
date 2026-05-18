import Swal from 'sweetalert2';
import { toast } from '@/components/Toaster';

/**
 * 一般操作回饋改走輕量 Toast；破壞性／需要明確確認的對話框仍走 SweetAlert。
 */

export const showSuccess = (title: string, description?: string) => {
  toast.success(title, description);
};

export const showError = (title: string, description?: string) => {
  toast.error(title, description);
};

export const showInfo = (title: string, description?: string) => {
  toast.info(title, description);
};

export const showWarning = (title: string, description?: string) => {
  toast.warning(title, description);
};

const tokenColor = (cssVar: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v ? `hsl(${v})` : fallback;
};

export const confirmAction = (title: string, text: string, confirmText = '確定', isDanger = false) =>
  Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: '取消',
    confirmButtonColor: isDanger ? tokenColor('--destructive', '#ef4444') : tokenColor('--primary', '#f47621'),
    reverseButtons: true,
    background: tokenColor('--card', '#ffffff'),
    color: tokenColor('--foreground', '#0f172a'),
  });
