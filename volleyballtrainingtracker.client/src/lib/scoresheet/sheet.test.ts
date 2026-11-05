import { describe, expect, it } from 'vitest';
import {
  addRow, bumpErrors, bumpStat, emptyContent, normalizeContent,
  popRally, pushRally, removeRow, setLineup,
} from './sheet';

const p7 = { playerId: 7, name: '小美', jerseyNo: 7 };

describe('sheet 文件模型', () => {
  it('addRow ignores duplicate player', () => {
    const c = addRow(addRow(emptyContent(), p7), p7);
    expect(c.rows.length).toBe(1);
  });

  it('bumpStat increments and creates counts', () => {
    let c = addRow(emptyContent(), p7);
    c = bumpStat(bumpStat(c, 7, 'serveO', 1), 7, 'serveO', 1);
    expect(c.rows[0].counts.serveO).toBe(2);
  });

  it('decrement stops at zero', () => {
    const c = bumpStat(addRow(emptyContent(), p7), 7, 'serveX', -1);
    expect(c.rows[0].counts.serveX ?? 0).toBe(0);
  });

  it('bumpErrors 不低於 0', () => {
    let c = bumpErrors(emptyContent(), 'opp', 1);
    c = bumpErrors(c, 'our', -1);
    expect(c.oppErrors).toBe(1);
    expect(c.ourErrors).toBe(0);
  });

  it('removeRow clears lineup slot', () => {
    let c = setLineup(addRow(emptyContent(), p7), 0, 7);
    expect(c.lineup[0]).toBe(7);
    c = removeRow(c, 7);
    expect(c.lineup[0]).toBeNull();
    expect(c.rows.length).toBe(0);
  });

  it('push/popRally，空時 pop 為 no-op', () => {
    const e = emptyContent();
    expect(popRally(e)).toEqual(e);
    const c = pushRally(pushRally(e, 'U'), 'TO');
    expect(c.rally).toEqual(['U', 'TO']);
    expect(popRally(c).rally).toEqual(['U']);
  });

  it('normalizeContent fills defaults', () => {
    expect(normalizeContent({})).toEqual(emptyContent());
    expect(normalizeContent(null)).toEqual(emptyContent());
  });

  it('normalizeContent 過濾不合法資料', () => {
    const c = normalizeContent({
      lineup: [1, 'x'],
      rows: [{ playerId: 3, name: 'a', counts: { serveO: 2, bad: 5, atkO: -1 } }, { name: 'no id' }],
      oppErrors: -2,
      rally: ['U', 'Z', 'TO'],
    });
    expect(c.lineup).toEqual([1, null, null, null, null, null]);
    expect(c.rows).toEqual([{ playerId: 3, name: 'a', jerseyNo: null, counts: { serveO: 2 } }]);
    expect(c.oppErrors).toBe(0);
    expect(c.rally).toEqual(['U', 'TO']);
  });

  it('functions do not mutate input', () => {
    const c = emptyContent();
    Object.freeze(c); Object.freeze(c.rows); Object.freeze(c.lineup); Object.freeze(c.rally);
    const a = addRow(c, p7);
    Object.freeze(a); Object.freeze(a.rows); Object.freeze(a.rows[0]); Object.freeze(a.rows[0].counts);
    expect(() => {
      bumpStat(a, 7, 'atkO', 1); setLineup(a, 1, 7); pushRally(a, 'U');
      removeRow(a, 7); bumpErrors(a, 'our', 1); popRally(a);
    }).not.toThrow();
  });
});
