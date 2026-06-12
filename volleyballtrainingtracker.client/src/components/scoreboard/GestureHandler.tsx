import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/** 垂直位移超過此值視為滑動，否則視為點擊（px） */
const SWIPE_THRESHOLD = 24;

interface GestureHandlerProps {
  /** 手勢結果回呼：+1 或 -1。由外層決定要調整哪個 state，本元件不碰 store */
  onAdjust: (delta: 1 | -1) => void;
  /** 無障礙名稱，例如「A 隊得分」 */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * 翻牌互動層，純手勢 → delta 轉換，不含任何比分邏輯：
 * - 向上滑動：+1；向下滑動：-1
 * - 位移很小（視為點擊）時：點在區塊上半部 +1、下半部 -1
 * - 鍵盤 ↑/↓ 同樣 +1/-1（無障礙）
 */
export default function GestureHandler({ onAdjust, label, className, children }: GestureHandlerProps) {
  const start = useRef<{ id: number; y: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { id: e.pointerId, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) >= SWIPE_THRESHOLD) {
      onAdjust(dy < 0 ? 1 : -1);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    onAdjust(e.clientY - rect.top < rect.height / 2 ? 1 : -1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onAdjust(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onAdjust(-1);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}（點上半部或上滑 +1，點下半部或下滑 -1）`}
      className={`group relative cursor-pointer select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded-xl ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (start.current = null)}
      onKeyDown={onKeyDown}
    >
      {children}
      {/* 操作提示：平時極淡，hover / 觸控聚焦時稍微浮現 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1 text-center text-[0.55rem] leading-none text-zinc-500 opacity-40 transition-opacity group-hover:opacity-90"
      >
        ▲
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[0.55rem] leading-none text-zinc-500 opacity-40 transition-opacity group-hover:opacity-90"
      >
        ▼
      </span>
    </div>
  );
}
