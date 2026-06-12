// 排球戰術板：戰術畫線的型別與幾何純函式
// 線條端點與球員一樣存「相對場地 viewBox 的 0~1 正規化座標」；
// 幾何計算（路徑、箭頭、命中、簡化）一律先轉成 viewBox 單位再算，
// 避免 x/y 軸比例不同（1000 vs 1900）造成方向與距離失真。

import { COURT_VIEW } from "@/lib/court";

export type DrawingKind = "line" | "arrow" | "freehand";
/** 戰術板工具模式：選取（球員拖曳＋線條編輯）／三種畫線／橡皮擦 */
export type DrawingTool = "select" | DrawingKind | "eraser";

export interface DrawingPoint {
  x: number;
  y: number;
}

/** 一條戰術線（未來儲存戰術時即 Drawings jsonb 的元素） */
export interface Drawing {
  id: string;
  kind: DrawingKind;
  /** 線色（hex）；路線語意（攻擊／跑位／防守…）由顏色區分 */
  color: string;
  /** 線寬（viewBox 單位，隨場地等比縮放） */
  width: number;
  /** 箭頭大小（viewBox 單位，僅 arrow；未指定時依線寬推算） */
  arrowSize?: number;
  /** line/arrow 固定 [起點, 終點]；freehand 為取樣點序列 */
  points: DrawingPoint[];
}

/** 色盤（亮／暗主題下都可辨識；預設紅＝攻擊路線直覺色） */
export const DRAWING_COLORS = [
  "#ef4444", // 紅
  "#f97316", // 橙
  "#eab308", // 黃
  "#22c55e", // 綠
  "#3b82f6", // 藍
  "#a855f7", // 紫
] as const;
export const DEFAULT_COLOR: string = DRAWING_COLORS[0];

/** 粗細選項（viewBox 單位；以場地最大寬 560px 換算約等於 2 / 3 / 5 px） */
export const DRAWING_WIDTHS = [
  { label: "細", value: 3.6 },
  { label: "中", value: 5.4 },
  { label: "粗", value: 9 },
] as const;
export const DEFAULT_WIDTH: number = DRAWING_WIDTHS[1].value;

/** 箭頭大小與線寬連動（UI 不另設控制，調粗細即同步調箭頭） */
export function arrowSizeFor(width: number): number {
  return width * 4.5;
}

/** 0~1 正規化座標 → viewBox 座標 */
export function toView(p: DrawingPoint): DrawingPoint {
  return { x: p.x * COURT_VIEW.w, y: p.y * COURT_VIEW.h };
}

const fmt = (p: DrawingPoint) => `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`;

/**
 * 產生線身的 SVG path d 字串（viewBox 單位）。
 * line/arrow＝直線段；freehand ≥3 點時用「中點二次貝茲」平滑折線。
 */
export function drawingPathD(d: Drawing): string {
  const pts = d.points.map(toView);
  if (pts.length === 0) return "";
  if (d.kind !== "freehand" || pts.length < 3) {
    return `M ${fmt(pts[0])}` + pts.slice(1).map((p) => ` L ${fmt(p)}`).join("");
  }
  let s = `M ${fmt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    s += ` Q ${fmt(pts[i])} ${fmt(mid)}`;
  }
  s += ` L ${fmt(pts[pts.length - 1])}`;
  return s;
}

/**
 * 箭頭三角形的 path d（填色用）。不用 SVG <marker>：
 * 顯式三角形的顏色／大小／命中／匯出全可控，且可單元測試。
 * 非 arrow 或方向無法判定（零長度）時回傳 null。
 */
export function arrowHeadPathD(d: Drawing): string | null {
  if (d.kind !== "arrow" || d.points.length < 2) return null;
  const pts = d.points.map(toView);
  const tip = pts[pts.length - 1];
  // 從尾端往回找第一個與 tip 不同的點，決定箭頭方向
  let from: DrawingPoint | null = null;
  for (let i = pts.length - 2; i >= 0; i--) {
    if (pts[i].x !== tip.x || pts[i].y !== tip.y) {
      from = pts[i];
      break;
    }
  }
  if (!from) return null;
  const len = Math.hypot(tip.x - from.x, tip.y - from.y);
  const ux = (tip.x - from.x) / len;
  const uy = (tip.y - from.y) / len;
  const size = d.arrowSize ?? arrowSizeFor(d.width);
  const base = { x: tip.x - ux * size, y: tip.y - uy * size };
  const half = size * 0.45;
  const left = { x: base.x - uy * half, y: base.y + ux * half };
  const right = { x: base.x + uy * half, y: base.y - ux * half };
  return `M ${fmt(tip)} L ${fmt(left)} L ${fmt(right)} Z`;
}

/** 點到線段的最短距離 */
export function distToSegment(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/** 點（viewBox 單位）到整條線的最短距離，用於橡皮擦／命中判定 */
export function distanceToDrawing(d: Drawing, viewPt: DrawingPoint): number {
  const pts = d.points.map(toView);
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return Math.hypot(viewPt.x - pts[0].x, viewPt.y - pts[0].y);
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const dd = distToSegment(viewPt, pts[i], pts[i + 1]);
    if (dd < min) min = dd;
  }
  return min;
}

/** Douglas-Peucker 簡化（在 viewBox 空間量距離，回傳原始正規化點的子集） */
export function simplifyPoints(points: DrawingPoint[], epsilonView = 4): DrawingPoint[] {
  if (points.length <= 2) return points;
  const view = points.map(toView);
  const keep = new Set<number>([0, points.length - 1]);

  const recurse = (first: number, last: number) => {
    let maxDist = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const dd = distToSegment(view[i], view[first], view[last]);
      if (dd > maxDist) {
        maxDist = dd;
        idx = i;
      }
    }
    if (idx > 0 && maxDist > epsilonView) {
      keep.add(idx);
      recurse(first, idx);
      recurse(idx, last);
    }
  };
  recurse(0, points.length - 1);

  return points.filter((_, i) => keep.has(i));
}

/**
 * 整條線平移（正規化位移），位移量會被夾住使所有點維持在場地內，
 * 避免線被拖出邊界後拿不回來。
 */
export function translatePoints(
  points: DrawingPoint[],
  dx: number,
  dy: number,
  pad = 0.01,
): DrawingPoint[] {
  if (points.length === 0) return points;
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cdx = Math.max(pad - minX, Math.min(1 - pad - maxX, dx));
  const cdy = Math.max(pad - minY, Math.min(1 - pad - maxY, dy));
  if (cdx === 0 && cdy === 0) return points;
  return points.map((p) => ({ x: p.x + cdx, y: p.y + cdy }));
}
