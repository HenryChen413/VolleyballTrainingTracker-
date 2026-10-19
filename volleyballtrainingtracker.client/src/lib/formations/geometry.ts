// 防守／接發站位：我方半場座標系（與 lib/court.ts 的全場座標系互不相干）。
// 正規化座標：x ∈ [0,1] 對應左邊線→右邊線（9m）；y ∈ [0,1] 對應球網→端線後 2m（共 11m）。
// 「左」以站在我方端線後、面向球網看：左前為 4 號位（畫面上球網在上方）。

export interface Point {
  x: number;
  y: number;
}

/** viewBox（0.1m 單位）：寬 = 0.5 + 9 + 0.5 m；高 = 網前 0.5m + 11m */
export const HALF_VIEW = { w: 1000, h: 1150 } as const;
export const HALF_PAD = 50;
export const HALF_COURT_W = 900;
export const HALF_DEPTH = 1100;

/** 端線（離網 9m）的正規化 y */
export const END_LINE_Y = 900 / HALF_DEPTH;
/** 攻擊線（離網 3m）的正規化 y */
export const ATTACK_LINE_Y = 300 / HALF_DEPTH;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function clampPoint(p: Point): Point {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

/** 正規化座標 → viewBox 座標（SVG 繪圖用） */
export function toView(p: Point): Point {
  return { x: HALF_PAD + p.x * HALF_COURT_W, y: HALF_PAD + p.y * HALF_DEPTH };
}

/** 正規化座標 → 容器百分比（token 絕對定位用） */
export function toPercent(p: Point): { left: number; top: number } {
  const v = toView(p);
  return { left: (v.x / HALF_VIEW.w) * 100, top: (v.y / HALF_VIEW.h) * 100 };
}

/** 容器內相對位置（0~1，相對容器寬高）→ 正規化座標（已夾在範圍內） */
export function fromContainerFraction(fx: number, fy: number): Point {
  return clampPoint({
    x: (fx * HALF_VIEW.w - HALF_PAD) / HALF_COURT_W,
    y: (fy * HALF_VIEW.h - HALF_PAD) / HALF_DEPTH,
  });
}
