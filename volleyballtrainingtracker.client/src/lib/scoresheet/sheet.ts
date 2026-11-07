import { STAT_KEYS, type StatKey } from './columns';

export type RallyItem = 'U' | 'O' | 'TU' | 'TO';

export interface SheetRow {
  playerId: number;
  name: string;
  jerseyNo: number | null;
  counts: Partial<Record<StatKey, number>>;
}

/** 換人：out 下場、in 上場，at 為當時 rally 長度（在比分條上的位置） */
export interface Sub {
  out: number;
  in: number;
  at: number;
}

export interface SheetContent {
  /** 長度 6，索引 0..5 = 1..6 號位 */
  lineup: (number | null)[];
  /** 長度 2，[接發自由, 防守自由]；只用一個自由時另一格為 null */
  liberos: (number | null)[];
  rows: SheetRow[];
  /** 換人紀錄，依發生順序 */
  subs: Sub[];
  oppErrors: number;
  ourErrors: number;
  rally: RallyItem[];
}

const RALLY_ITEMS: readonly string[] = ['U', 'O', 'TU', 'TO'];

export function emptyContent(): SheetContent {
  return { lineup: [null, null, null, null, null, null], liberos: [null, null], rows: [], subs: [], oppErrors: 0, ourErrors: 0, rally: [] };
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
    liberos: c.liberos.map((id) => (id === playerId ? null : id)),
    subs: c.subs.filter((s) => s.out !== playerId && s.in !== playerId),
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

/** slot：0 = 接發自由、1 = 防守自由 */
export function setLibero(c: SheetContent, slot: number, playerId: number | null): SheetContent {
  return { ...c, liberos: c.liberos.map((id, i) => (i === slot ? playerId : id)) };
}

export function addSub(c: SheetContent, out: number, inId: number): SheetContent {
  return { ...c, subs: [...c.subs, { out, in: inId, at: c.rally.length }] };
}

export function removeSub(c: SheetContent, index: number): SheetContent {
  return { ...c, subs: c.subs.filter((_, i) => i !== index) };
}

/** 目前在場上的人：第一球站位＋自由，再依序套用換人 */
export function onCourt(c: SheetContent): Set<number> {
  const set = new Set([...c.lineup, ...c.liberos].filter((id): id is number => id != null));
  for (const s of c.subs) {
    set.delete(s.out);
    set.add(s.in);
  }
  return set;
}

/**
 * 球員列的替補標記：非先發者標「替」，有換人紀錄則加上最近一次換下的人（背號，無背號用名字）。
 * 沒有任何先發也沒有換人時不標。
 */
export function subMarks(c: SheetContent): Record<number, string> {
  const starters = new Set([...c.lineup, ...c.liberos].filter((id): id is number => id != null));
  if (starters.size === 0 && c.subs.length === 0) return {};
  const replaced = new Map<number, number>();
  for (const s of c.subs) replaced.set(s.in, s.out);
  const labelOf = (id: number) => {
    const r = c.rows.find((x) => x.playerId === id);
    return r ? (r.jerseyNo != null ? String(r.jerseyNo) : r.name) : '';
  };
  const marks: Record<number, string> = {};
  for (const r of c.rows) {
    if (starters.has(r.playerId)) continue;
    const out = replaced.get(r.playerId);
    marks[r.playerId] = out != null ? `替${labelOf(out)}` : '替';
  }
  return marks;
}

/** 顯示用排序：背號小到大，無背號排最後；相同時維持原順序（不改動傳入陣列） */
export function sortRowsByJersey(rows: SheetRow[]): SheetRow[] {
  const key = (r: SheetRow) => r.jerseyNo ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) => key(a) - key(b));
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

  const liberos = base.liberos.map((_, i) => {
    const v = Array.isArray(o.liberos) ? o.liberos[i] : null;
    return isInt(v) ? v : null;
  });

  const subs: Sub[] = [];
  if (Array.isArray(o.subs)) {
    for (const s of o.subs) {
      if (!s || typeof s !== 'object') continue;
      const x = s as Record<string, unknown>;
      if (!isInt(x.out) || !isInt(x.in) || !isInt(x.at) || x.out === x.in || x.at < 0) continue;
      subs.push({ out: x.out, in: x.in, at: x.at });
    }
  }

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

  return { lineup, liberos, rows, subs, oppErrors: nonNeg(o.oppErrors), ourErrors: nonNeg(o.ourErrors), rally };
}
