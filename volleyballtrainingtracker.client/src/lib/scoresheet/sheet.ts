import { STAT_KEYS, type StatKey } from './columns';

export type RallyItem = 'U' | 'O' | 'TU' | 'TO';

export interface SheetRow {
  playerId: number;
  name: string;
  jerseyNo: number | null;
  counts: Partial<Record<StatKey, number>>;
}

export interface SheetContent {
  /** 長度 6，索引 0..5 = 1..6 號位 */
  lineup: (number | null)[];
  rows: SheetRow[];
  oppErrors: number;
  ourErrors: number;
  rally: RallyItem[];
}

const RALLY_ITEMS: readonly string[] = ['U', 'O', 'TU', 'TO'];

export function emptyContent(): SheetContent {
  return { lineup: [null, null, null, null, null, null], rows: [], oppErrors: 0, ourErrors: 0, rally: [] };
}

export function addRow(c: SheetContent, p: { playerId: number; name: string; jerseyNo: number | null }): SheetContent {
  if (c.rows.some((r) => r.playerId === p.playerId)) return c;
  return { ...c, rows: [...c.rows, { playerId: p.playerId, name: p.name, jerseyNo: p.jerseyNo, counts: {} }] };
}

export function removeRow(c: SheetContent, playerId: number): SheetContent {
  return {
    ...c,
    rows: c.rows.filter((r) => r.playerId !== playerId),
    lineup: c.lineup.map((id) => (id === playerId ? null : id)),
  };
}

export function bumpStat(c: SheetContent, playerId: number, key: StatKey, delta: 1 | -1): SheetContent {
  return {
    ...c,
    rows: c.rows.map((r) =>
      r.playerId === playerId
        ? { ...r, counts: { ...r.counts, [key]: Math.max(0, (r.counts[key] ?? 0) + delta) } }
        : r),
  };
}

export function bumpErrors(c: SheetContent, side: 'opp' | 'our', delta: 1 | -1): SheetContent {
  return side === 'opp'
    ? { ...c, oppErrors: Math.max(0, c.oppErrors + delta) }
    : { ...c, ourErrors: Math.max(0, c.ourErrors + delta) };
}

export function setLineup(c: SheetContent, slot: number, playerId: number | null): SheetContent {
  return { ...c, lineup: c.lineup.map((id, i) => (i === slot ? playerId : id)) };
}

export function pushRally(c: SheetContent, item: RallyItem): SheetContent {
  return { ...c, rally: [...c.rally, item] };
}

export function popRally(c: SheetContent): SheetContent {
  return c.rally.length === 0 ? c : { ...c, rally: c.rally.slice(0, -1) };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const nonNeg = (v: unknown): number => (isInt(v) && v > 0 ? v : 0);

/** 伺服器／本機資料容錯：缺欄位補預設，丟棄不合法項目 */
export function normalizeContent(raw: unknown): SheetContent {
  const base = emptyContent();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  const lineup = base.lineup.map((_, i) => {
    const v = Array.isArray(o.lineup) ? o.lineup[i] : null;
    return isInt(v) ? v : null;
  });

  const rows: SheetRow[] = [];
  if (Array.isArray(o.rows)) {
    for (const r of o.rows) {
      if (!r || typeof r !== 'object') continue;
      const x = r as Record<string, unknown>;
      if (!isInt(x.playerId) || rows.some((e) => e.playerId === x.playerId)) continue;
      const counts: Partial<Record<StatKey, number>> = {};
      const rc = (x.counts && typeof x.counts === 'object' ? x.counts : {}) as Record<string, unknown>;
      for (const k of STAT_KEYS) {
        const n = nonNeg(rc[k]);
        if (n > 0) counts[k] = n;
      }
      rows.push({
        playerId: x.playerId,
        name: typeof x.name === 'string' ? x.name : '',
        jerseyNo: isInt(x.jerseyNo) ? x.jerseyNo : null,
        counts,
      });
    }
  }

  const rally = Array.isArray(o.rally)
    ? o.rally.filter((v): v is RallyItem => typeof v === 'string' && RALLY_ITEMS.includes(v))
    : [];

  return { lineup, rows, oppErrors: nonNeg(o.oppErrors), ourErrors: nonNeg(o.ourErrors), rally };
}
