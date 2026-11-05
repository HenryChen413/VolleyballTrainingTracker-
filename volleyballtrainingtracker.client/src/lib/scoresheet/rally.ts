import type { RallyItem } from './sheet';

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
}

/** 比分發展：每個項目一欄，得分方顯示累計分，另一方留空；暫停獨佔一欄 */
export function layoutRally(rally: RallyItem[]): RallyCell[] {
  let our = 0;
  let opp = 0;
  return rally.map((r): RallyCell => {
    if (r === 'U') return { our: String(++our), opp: '', timeout: null };
    if (r === 'O') return { our: '', opp: String(++opp), timeout: null };
    return { our: '', opp: '', timeout: r === 'TU' ? 'U' : 'O' };
  });
}
