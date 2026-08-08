import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFullscreen } from './useFullscreen';

/** jsdom 未實作 Fullscreen API，逐項以 defineProperty 模擬 */
function stubFullscreen(opts: {
  enabled: boolean;
  request?: () => Promise<void>;
}) {
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    value: opts.enabled,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    writable: true,
    value: null,
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: opts.request ?? (() => Promise.resolve()),
  });
}

describe('useFullscreen', () => {
  beforeEach(() => {
    stubFullscreen({ enabled: true });
  });

  it('原生 API 可用時呼叫 requestFullscreen，不進入 CSS 假全螢幕', () => {
    const request = vi.fn(() => Promise.resolve());
    stubFullscreen({ enabled: true, request });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    const el = document.createElement('div');
    document.body.appendChild(el);
    result.current.ref.current = el;

    act(() => result.current.toggle());

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.cssFullscreen).toBe(false);
  });

  it('fullscreenEnabled 為 false 時退回 CSS 假全螢幕', () => {
    stubFullscreen({ enabled: false });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    result.current.ref.current = document.createElement('div');

    act(() => result.current.toggle());

    expect(result.current.cssFullscreen).toBe(true);
    expect(result.current.isFullscreen).toBe(true);
  });

  it('原生請求被拒時退回 CSS 假全螢幕', async () => {
    stubFullscreen({ enabled: true, request: () => Promise.reject(new Error('denied')) });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    result.current.ref.current = document.createElement('div');

    await act(async () => {
      result.current.toggle();
      await Promise.resolve();
    });

    expect(result.current.cssFullscreen).toBe(true);
  });

  it('fullscreenchange 事件會同步狀態（系統手勢或 ESC 退出）', () => {
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    const el = document.createElement('div');

    act(() => {
      (document as { fullscreenElement: Element | null }).fullscreenElement = el;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.isFullscreen).toBe(true);

    act(() => {
      (document as { fullscreenElement: Element | null }).fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.isFullscreen).toBe(false);
  });

  it('CSS 假全螢幕下按 ESC 會退出', () => {
    stubFullscreen({ enabled: false });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    result.current.ref.current = document.createElement('div');

    act(() => result.current.toggle());
    expect(result.current.cssFullscreen).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.cssFullscreen).toBe(false);
  });
});
