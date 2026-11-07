import type { RallyItem, Sub } from './sheet';

export function scoreOf(rally: RallyItem[]): { our: number; opp: number } {
  let our = 0;
  let opp = 0;
  for (const r of rally) {
    if (r === 'U') our++;
    else if (r === 'O') opp++;
  }
  return { our, opp };
}

export interface RallyCell {
  our: string;
  opp: string;
  timeout: 'U' | 'O' | null;
  /** 換人欄才有 */
  sub?: { out: number; in: number };
}

/**
 * 比分發展：每個項目一欄，得分方顯示累計分，另一方留空；暫停與換人各獨佔一欄。
 * 換人依 at（記錄當時的 rally 長度）插在該位置之前；at 超出長度時放在最後。
 */
export function layoutRally(rally: RallyItem[], subs: readonly Sub[] = []): RallyCell[] {
  let our = 0;
  let opp = 0;
  const cells: RallyCell[] = [];
  const pushSubsAt = (pos: number, last: boolean) => {
    for (const s of subs) {
      if (s.at === pos || (last && s.at > pos)) {
        cells.push({ our: '', opp: '', timeout: null, sub: { out: s.out, in: s.in } });
      }
    }
  };
  rally.forEach((r, i) => {
    pushSubsAt(i, false);
    if (r === 'U') cells.push({ our: String(++our), opp: '', timeout: null });
    else if (r === 'O') cells.push({ our: '', opp: String(++opp), timeout: null });
    else cells.push({ our: '', opp: '', timeout: r === 'TU' ? 'U' : 'O' });
  });
  pushSubsAt(rally.length, true);
  return cells;
}
