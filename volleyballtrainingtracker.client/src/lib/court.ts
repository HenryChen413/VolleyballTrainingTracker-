// 排球戰術板：場地幾何常數與座標工具
// 座標系統：viewBox 以 0.1m 為單位（標準場 9m × 18m + 四周 0.5m 緩衝區），
// 球員座標一律存「相對 viewBox 的 0~1 正規化值」，確保任何螢幕尺寸下位置一致，
// 也是未來儲存戰術（jsonb Layout）使用的座標格式。

/** viewBox 尺寸（0.1m 單位）：寬 = 0.5 + 9 + 0.5 m、高 = 0.5 + 18 + 0.5 m */
export const COURT_VIEW = { w: 1000, h: 1900 } as const;

/** 場地外框（緩衝區內緣） */
export const COURT_RECT = { x: 50, y: 50, w: 900, h: 1800 } as const;

/** 球網（中線）Y 座標 */
export const NET_Y = COURT_RECT.y + COURT_RECT.h / 2; // 950

/** 攻擊線（離中線 3m） */
export const ATTACK_LINE_OPP = NET_Y - 300; // 對方場區
export const ATTACK_LINE_OUR = NET_Y + 300; // 我方場區

/** 場上球員（含未來儲存戰術的 Layout.courtPlayers 元素） */
export interface CourtPlayer {
  playerId: number;
  jerseyNo: number | null;
  name: string;
  /** 主要位置代碼（OH/OPP/MB/S/L），用於 token 配色 */
  role: string | null;
  /** 相對 viewBox 的正規化座標（0~1） */
  x: number;
  y: number;
}

/** 名單中的球員（來源：現役球員或賽事報名球員 snapshot） */
export interface RosterPlayer {
  playerId: number;
  jerseyNo: number | null;
  name: string;
  position: string | null;
}

const col = (frac: number) => (COURT_RECT.x + COURT_RECT.w * frac) / COURT_VIEW.w;
const row = (y: number) => y / COURT_VIEW.h;

/**
 * 我方場區六個輪轉位置錨點（正規化座標）。
 * 佈局（自球網往底線看）：
 *   4 3 2  ← 前排
 *   5 6 1  ← 後排
 */
export const ROTATION_ANCHORS: ReadonlyArray<{ pos: number; x: number; y: number }> = [
  { pos: 4, x: col(1 / 6), y: row(NET_Y + 200) },
  { pos: 3, x: col(3 / 6), y: row(NET_Y + 200) },
  { pos: 2, x: col(5 / 6), y: row(NET_Y + 200) },
  { pos: 5, x: col(1 / 6), y: row(NET_Y + 650) },
  { pos: 6, x: col(3 / 6), y: row(NET_Y + 650) },
  { pos: 1, x: col(5 / 6), y: row(NET_Y + 650) },
];

/** 把正規化座標夾在場線範圍內（球員用，留 token 半徑的邊距） */
export function clampToCourt(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(0.95, Math.max(0.05, x)),
    y: Math.min(0.97, Math.max(0.03, y)),
  };
}

/**
 * 把正規化座標夾在整個 viewBox 內（戰術線用）。
 * 相對 clampToCourt 多出場地四周的 0.5m 緩衝區 —— 發球（端線後起跳）、
 * 界外球路線等戰術本來就發生在場線之外，線條不該被夾在場內。
 */
export function clampToView(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

/** 瀏覽器座標（clientX/Y）→ 正規化座標，夾在場線內（球員 token 用） */
export function clientToNorm(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  return clampToCourt((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);
}

/** 瀏覽器座標（clientX/Y）→ 正規化座標，可及緩衝區邊緣（戰術線用） */
export function clientToViewNorm(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  return clampToView((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);
}

/** 兩名場上球員在「畫面像素」上的距離（用於交換/碰撞判定，避免正規化座標被長寬比扭曲） */
export function pixelDistance(rect: DOMRect, a: CourtPlayer, b: CourtPlayer): number {
  const dx = (a.x - b.x) * rect.width;
  const dy = (a.y - b.y) * rect.height;
  return Math.hypot(dx, dy);
}

/** 找出尚未被占用的第一個輪轉錨點（依 1→6 輪轉序），全滿則回 null */
export function firstFreeAnchor(
  courtPlayers: ReadonlyArray<CourtPlayer>,
  rect: DOMRect | null,
): { x: number; y: number } | null {
  // 依輪轉順序 1,2,3,4,5,6 補位，符合排陣直覺
  const order = [...ROTATION_ANCHORS].sort((a, b) => a.pos - b.pos);
  for (const anchor of order) {
    const occupied = courtPlayers.some((p) => {
      if (rect) {
        const dx = (p.x - anchor.x) * rect.width;
        const dy = (p.y - anchor.y) * rect.height;
        return Math.hypot(dx, dy) < 32;
      }
      // 尚無 rect 時退回正規化距離粗略判定
      return Math.abs(p.x - anchor.x) < 0.08 && Math.abs(p.y - anchor.y) < 0.05;
    });
    if (!occupied) return { x: anchor.x, y: anchor.y };
  }
  return null;
}
