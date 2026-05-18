import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** 套用至 <html class>。傳入當前 mode（或從 store 取） */
  apply: (mode?: ThemeMode) => void;
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyToDom(mode: ThemeMode) {
  const effective = resolve(mode);
  const root = document.documentElement;
  if (effective === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => {
        set({ mode });
        applyToDom(mode);
      },
      apply: (mode) => applyToDom(mode ?? get().mode),
    }),
    { name: 'vbtt-theme' },
  ),
);

/** 在 App 啟動時呼叫一次：套用初始主題並監聽系統偏好變化 */
export function initTheme() {
  const { apply, mode } = useThemeStore.getState();
  apply(mode);

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (useThemeStore.getState().mode === 'system') {
      apply('system');
    }
  };
  mql.addEventListener?.('change', handler);
}
