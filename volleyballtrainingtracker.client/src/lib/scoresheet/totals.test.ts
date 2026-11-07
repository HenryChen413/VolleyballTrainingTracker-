import { describe, expect, it } from 'vitest';
import { addRow, bumpErrors, bumpStat, emptyContent } from './sheet';
import { autoOurErrors, sumSheets } from './totals';

const mk = (id: number, n: number) => {
  let c = addRow(emptyContent(), { playerId: id, name: `p${id}`, jerseyNo: id });
  for (let i = 0; i < n; i++) c = bumpStat(c, id, 'serveO', 1);
  return c;
};

describe('autoOurErrors', () => {
  it('sums error cells across rows only', () => {
    let c = addRow(addRow(emptyContent(), { playerId: 1, name: 'a', jerseyNo: 1 }), { playerId: 2, name: 'b', jerseyNo: 2 });
    c = bumpStat(c, 1, 'recvX', 1);
    c = bumpStat(c, 1, 'recvO', 1);
    c = bumpStat(c, 2, 'digShank', 1);
    c = bumpStat(c, 2, 'atkOut', 1);
    expect(autoOurErrors(c.rows)).toBe(3);
  });
});

describe('sumSheets', () => {
  it('merges rows by playerId', () => {
    const r = sumSheets([mk(7, 1), addRow(mk(7, 2), { playerId: 9, name: 'p9', jerseyNo: 9 })]);
    expect(r.rows.map((x) => x.playerId)).toEqual([7, 9]);
    expect(r.rows[0].counts.serveO).toBe(3);
    expect(r.rows[1].counts).toEqual({});
  });

  it('counts sets played per player', () => {
    const r = sumSheets([mk(7, 1), addRow(mk(7, 0), { playerId: 9, name: 'p9', jerseyNo: 9 }), mk(9, 0)]);
    expect(r.setsPlayed).toEqual({ 7: 2, 9: 2 });
  });

  it('sums errors', () => {
    const a = bumpErrors(emptyContent(), 'opp', 1);
    const b = bumpErrors(bumpErrors(emptyContent(), 'opp', 1), 'our', 1);
    expect(sumSheets([a, b])).toMatchObject({ oppErrors: 2, ourErrors: 1 });
  });
});
