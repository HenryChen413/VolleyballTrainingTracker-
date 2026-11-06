import { describe, expect, it } from 'vitest';
import { addRow, bumpErrors, bumpStat, emptyContent } from './sheet';
import { sumSheets } from './totals';

const mk = (id: number, n: number) => {
  let c = addRow(emptyContent(), { playerId: id, name: `p${id}`, jerseyNo: id });
  for (let i = 0; i < n; i++) c = bumpStat(c, id, 'serveO', 1);
  return c;
};

describe('sumSheets', () => {
  it('merges rows by playerId', () => {
    const r = sumSheets([mk(7, 1), addRow(mk(7, 2), { playerId: 9, name: 'p9', jerseyNo: 9 })]);
    expect(r.rows.map((x) => x.playerId)).toEqual([7, 9]);
    expect(r.rows[0].counts.serveO).toBe(3);
    expect(r.rows[1].counts).toEqual({});
  });

  it('sums errors', () => {
    const a = bumpErrors(emptyContent(), 'opp', 1);
    const b = bumpErrors(bumpErrors(emptyContent(), 'opp', 1), 'our', 1);
    expect(sumSheets([a, b])).toMatchObject({ oppErrors: 2, ourErrors: 1 });
  });
});
