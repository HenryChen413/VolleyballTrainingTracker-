import Swal from 'sweetalert2';
import { toast } from '@/lib/toast';

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

/**
 * 若目前有開啟中的 Radix Dialog，回傳該 Dialog 的內容元素，否則回傳 undefined。
 *
 * SweetAlert 在 modal 模式下會對 <body> 底下所有「不包含 swal 容器」的子節點加上
 * aria-hidden="true"；Radix Dialog 的內容區正是這樣一個直接子節點，且此時焦點仍被
 * Radix 的 focus trap 鎖在其中，於是瀏覽器會發出「aria-hidden 套在持有焦點的元素」警告，
 * 並且 Radix 還會把焦點從 SweetAlert 的按鈕搶回 Dialog（鍵盤焦點失效）。
 *
 * 把 SweetAlert 用 target 掛進該 Dialog 內可同時解決兩者：
 *  - 該子節點因「包含 swal 容器」被 setAriaHidden 略過，焦點所在元素不再被 aria-hidden。
 *  - 確認鈕落在 Dialog 的 focus trap 範圍內，Radix 不會再搶回焦點。
 */
const openDialogTarget = (): HTMLElement | undefined => {
  if (typeof document === 'undefined') return undefined;
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]');
  return dialogs.length ? dialogs[dialogs.length - 1] : undefined;
};

export const confirmAction = (title: string, text: string, confirmText = '確定', isDanger = false) => {
  const target = openDialogTarget();
  return Swal.fire({
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
    // 對話框開啟時掛進對話框內，避免 aria-hidden / focus trap 衝突（見 openDialogTarget）。
    // heightAuto:false 避免 SweetAlert 改動 <html>/<body> 高度造成版面跳動。
    ...(target ? { target, heightAuto: false } : {}),
  });
};
