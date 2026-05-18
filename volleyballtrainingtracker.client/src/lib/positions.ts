// 球員位置共用工具
// DB 儲存值仍為英文代碼（OH/OPP/MB/S/L），多個位置以逗號分隔
// 顯示順序固定：舉球員 → 主攻 → 副攻 → 攔中 → 自由 → 其他

export const POSITION_ORDER = ["S", "OH", "OPP", "MB", "L"] as const;
export type PositionCode = (typeof POSITION_ORDER)[number];

export const POSITION_LABELS: Record<string, string> = {
  S: "舉球員",
  OH: "主攻",
  OPP: "副攻",
  MB: "攔中",
  L: "自由",
};

export const POSITION_TONE: Record<
  string,
  "primary" | "info" | "navy" | "warning" | "success"
> = {
  OH: "primary",
  OPP: "info",
  MB: "navy",
  S: "warning",
  L: "success",
};

/** 「OH,MB」→ ["OH","MB"]；空字串/null → [] */
export function parsePositions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 取第一個有效位置；無 → null */
export function primaryPosition(raw: string | null | undefined): string | null {
  const list = parsePositions(raw);
  return list.length > 0 ? list[0] : null;
}

/** 群組 key（未分類用 "_other"） */
export const OTHER_KEY = "_other" as const;
export const OTHER_LABEL = "其他";

/** 依固定順序回傳每個群組的 key 與 items；空群組會被過濾掉 */
export function groupByPrimaryPosition<T>(
  items: T[],
  getPositionRaw: (item: T) => string | null | undefined,
): Array<{ key: string; label: string; items: T[] }> {
  const buckets: Record<string, T[]> = {};
  for (const it of items) {
    const p = primaryPosition(getPositionRaw(it)) ?? OTHER_KEY;
    (buckets[p] ??= []).push(it);
  }
  const ordered = [...POSITION_ORDER, OTHER_KEY] as readonly string[];
  return ordered
    .filter((k) => (buckets[k]?.length ?? 0) > 0)
    .map((k) => ({
      key: k,
      label: k === OTHER_KEY ? OTHER_LABEL : POSITION_LABELS[k] ?? k,
      items: buckets[k],
    }));
}
