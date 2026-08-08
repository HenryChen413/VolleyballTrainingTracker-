import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * iOS Safari 的 Fullscreen API 支援度補丁型別：
 * - iPhone：完全不支援（requestFullscreen 為 undefined，或存在但靜默無效）
 * - 舊版 iPad：只認 webkit 前綴
 */
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
  webkitFullscreenEnabled?: boolean;
};

export interface UseFullscreenResult<T extends HTMLElement> {
  /** 掛到要全螢幕的元素上 */
  ref: React.RefObject<T | null>;
  /** 原生或 CSS 假全螢幕，任一成立 */
  isFullscreen: boolean;
  /** true 表示走 CSS 假全螢幕，呼叫端需自行套 fixed inset-0 之類的樣式 */
  cssFullscreen: boolean;
  toggle: () => void;
  exit: () => void;
}

/**
 * 全螢幕切換：原生 Fullscreen API 優先，不支援或被拒時退回 CSS 假全螢幕。
 *
 * iPhone Safari 會暴露 webkitRequestFullscreen 但呼叫後靜默無效，
 * 因此不能只看函式是否存在，必須以 fullscreenEnabled 特性偵測把關。
 */
export function useFullscreen<T extends HTMLElement>(): UseFullscreenResult<T> {
  const ref = useRef<T | null>(null);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  // 同步原生全螢幕狀態（含 ESC／系統手勢退出），webkit 前綴事件給舊 iPad
  useEffect(() => {
    const doc = document as FullscreenDocument;
    const sync = () =>
      setNativeFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  // CSS 假全螢幕沒有瀏覽器內建的 ESC 行為，自己補
  useEffect(() => {
    if (!cssFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCssFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cssFullscreen]);

  const exit = useCallback(() => {
    const doc = document as FullscreenDocument;
    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
      return;
    }
    setCssFullscreen(false);
  }, []);

  const toggle = useCallback(() => {
    const doc = document as FullscreenDocument;
    const el = ref.current as FullscreenElement | null;
    if (!el) return;

    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }

    const supported = document.fullscreenEnabled || doc.webkitFullscreenEnabled === true;
    if (!supported) {
      setCssFullscreen(true);
      return;
    }
    try {
      if (el.requestFullscreen) {
        // 原生請求可能被拒（權限／嵌入環境），失敗時退回 CSS 全螢幕
        el.requestFullscreen().catch(() => setCssFullscreen(true));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        setCssFullscreen(true);
      }
    } catch {
      setCssFullscreen(true);
    }
  }, [cssFullscreen]);

  return {
    ref,
    isFullscreen: nativeFullscreen || cssFullscreen,
    cssFullscreen,
    toggle,
    exit,
  };
}
