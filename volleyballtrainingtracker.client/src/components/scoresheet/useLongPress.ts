import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';

export interface PointerEventHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** 只處理鍵盤觸發的 click（detail === 0），觸控／滑鼠已由 pointer 事件處理 */
  onClick: (e: React.MouseEvent) => void;
}

interface Options {
  onClick(): void;
  onLongPress(): void;
  /** 長按判定毫秒數，預設 500 */
  ms?: number;
}

/** 手指移動超過此距離（px）視為捲動，取消本次點擊／長按 */
const MOVE_TOLERANCE = 10;

/**
 * 點擊與長按共用的 pointer 事件處理：
 * - 按下後放開（未達 ms）→ onClick
 * - 按住達 ms → onLongPress 一次，放開時不再觸發 onClick
 * - 移出、取消（例如開始捲動）或移動過多 → 兩者都不觸發
 */
export function useLongPress({ onClick, onLongPress, ms = 500 }: Options): PointerEventHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cbRef = useRef({ onClick, onLongPress });

  useEffect(() => {
    cbRef.current = { onClick, onLongPress };
  }, [onClick, onLongPress]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    clear();
    activeRef.current = false;
    startRef.current = null;
  }, [clear]);

  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 只處理主要按鍵（滑鼠左鍵／單指觸控）
      if (e.button !== undefined && e.button > 0) return;
      clear();
      activeRef.current = true;
      startRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!activeRef.current) return;
        activeRef.current = false;
        cbRef.current.onLongPress();
      }, ms);
    },
    [clear, ms],
  );

  const onPointerUp = useCallback(() => {
    if (!activeRef.current) return;
    cancel();
    cbRef.current.onClick();
  }, [cancel]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = startRef.current;
      if (!activeRef.current || !s) return;
      if (Math.abs(e.clientX - s.x) > MOVE_TOLERANCE || Math.abs(e.clientY - s.y) > MOVE_TOLERANCE) cancel();
    },
    [cancel],
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // 避免 iOS／Android 長按跳出選單
    e.preventDefault();
  }, []);

  const onClickKey = useCallback((e: React.MouseEvent) => {
    if (e.detail === 0) cbRef.current.onClick();
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu,
    onClick: onClickKey,
  };
}
