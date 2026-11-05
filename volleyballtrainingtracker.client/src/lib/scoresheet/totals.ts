import type { StatKey } from './columns';
import type { SheetContent, SheetRow } from './sheet';

/** 多局合計：球員依 playerId 合併（依第一次出現順序），失誤相加 */
export function sumSheets(sheets: SheetContent[]): { rows: SheetRow[]; oppErrors: number; ourErrors: number } {
  const map = new Map<number, SheetRow>();
  let oppErrors = 0;
  let ourErrors = 0;
  for (const s of sheets) {
    oppErrors += s.oppErrors;
    ourErrors += s.ourErrors;
    for (const r of s.rows) {
      const prev = map.get(r.playerId);
      const counts: Partial<Record<StatKey, number>> = { ...(prev?.counts ?? {}) };
      for (const [k, v] of Object.entries(r.counts) as [StatKey, number][]) {
        counts[k] = (counts[k] ?? 0) + v;
      }
      map.set(r.playerId, { ...(prev ?? r), counts });
    }
  }
  return { rows: [...map.values()], oppErrors, ourErrors };
}
