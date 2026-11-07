import { OUR_ERROR_KEYS, type StatKey } from './columns';
import type { SheetContent, SheetRow } from './sheet';

/** 由球員格子自動加總的我方失誤（不含手動補記的 ourErrors） */
export function autoOurErrors(rows: SheetRow[]): number {
  let n = 0;
  for (const r of rows) {
    for (const k of OUR_ERROR_KEYS) n += r.counts[k] ?? 0;
  }
  return n;
}

/** 多局合計：球員依 playerId 合併（依第一次出現順序），失誤相加，setsPlayed 為各球員出現在幾局 */
export function sumSheets(sheets: SheetContent[]): {
  rows: SheetRow[];
  oppErrors: number;
  ourErrors: number;
  setsPlayed: Record<number, number>;
} {
  const map = new Map<number, SheetRow>();
  const setsPlayed: Record<number, number> = {};
  let oppErrors = 0;
  let ourErrors = 0;
  for (const s of sheets) {
    oppErrors += s.oppErrors;
    ourErrors += s.ourErrors;
    for (const r of s.rows) {
      setsPlayed[r.playerId] = (setsPlayed[r.playerId] ?? 0) + 1;
      const prev = map.get(r.playerId);
      const counts: Partial<Record<StatKey, number>> = { ...(prev?.counts ?? {}) };
      for (const [k, v] of Object.entries(r.counts) as [StatKey, number][]) {
        counts[k] = (counts[k] ?? 0) + v;
      }
      map.set(r.playerId, { ...(prev ?? r), counts });
    }
  }
  return { rows: [...map.values()], oppErrors, ourErrors, setsPlayed };
}
