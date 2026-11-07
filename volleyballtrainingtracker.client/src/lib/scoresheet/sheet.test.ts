import { describe, expect, it } from 'vitest';
import {
  addRow, bumpErrors, bumpStat, emptyContent, normalizeContent,
  addSub, onCourt, popRally, pushRally, removeRow, removeSub, setLibero, setLineup, sortRowsByJersey, subMarks,
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

  it('emptyContent 有兩格空的自由球員', () => {
    expect(emptyContent().liberos).toEqual([null, null]);
  });

  it('setLibero 設定接發／防守自由', () => {
    let c = setLibero(addRow(emptyContent(), p7), 1, 7);
    expect(c.liberos).toEqual([null, 7]);
    c = setLibero(c, 1, null);
    expect(c.liberos).toEqual([null, null]);
  });

  it('removeRow clears libero slot', () => {
    const c = removeRow(setLibero(addRow(emptyContent(), p7), 0, 7), 7);
    expect(c.liberos).toEqual([null, null]);
  });

  it('normalizeContent：舊資料沒有 liberos 時補空、不合法值丟棄', () => {
    expect(normalizeContent({ lineup: [] }).liberos).toEqual([null, null]);
    expect(normalizeContent({ liberos: [3, 'x', 9] }).liberos).toEqual([3, null]);
  });

  it('sortRowsByJersey：背號小到大，無背號排最後，相同時維持原順序', () => {
    const r = (playerId: number, jerseyNo: number | null) => ({ playerId, name: `p${playerId}`, jerseyNo, counts: {} });
    const rows = [r(1, 12), r(2, null), r(3, 3), r(4, null), r(5, 12), r(6, 1)];
    expect(sortRowsByJersey(rows).map((x) => x.playerId)).toEqual([6, 3, 1, 5, 2, 4]);
    expect(rows.map((x) => x.playerId)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  describe('換人', () => {
    const base = () => {
      let c = emptyContent();
      for (const [id, no] of [[1, 1], [2, 2], [3, 3], [4, null]] as const) {
        c = addRow(c, { playerId: id, name: `p${id}`, jerseyNo: no });
      }
      c = setLineup(c, 0, 1);
      c = setLineup(c, 1, 2);
      return pushRally(pushRally(c, 'U'), 'O');
    };

    it('addSub records out/in at current rally position', () => {
      const c = addSub(base(), 1, 3);
      expect(c.subs).toEqual([{ out: 1, in: 3, at: 2 }]);
    });

    it('onCourt starts from lineup + liberos and applies subs in order', () => {
      let c = setLibero(base(), 0, 4);
      expect([...onCourt(c)].sort()).toEqual([1, 2, 4]);
      c = addSub(c, 1, 3);
      expect([...onCourt(c)].sort()).toEqual([2, 3, 4]);
      c = addSub(c, 3, 1);
      expect([...onCourt(c)].sort()).toEqual([1, 2, 4]);
    });

    it('subMarks: 替+換下背號（最近一次），先發回場不標，未記換人的替補只標替', () => {
      let c = addSub(base(), 1, 3);
      c = addSub(c, 2, 4);
      expect(subMarks(c)).toEqual({ 3: '替1', 4: '替2' });
      c = addSub(c, 3, 1); // 先發 1 回場
      expect(subMarks(c)).toEqual({ 3: '替1', 4: '替2' });
      const d = addRow(base(), { playerId: 9, name: 'p9', jerseyNo: 9 });
      expect(subMarks(d)).toEqual({ 3: '替', 4: '替', 9: '替' });
    });

    it('subMarks uses name when the replaced player has no jersey', () => {
      const c = addSub(setLineup(base(), 2, 4), 4, 3);
      expect(subMarks(c)[3]).toBe('替p4');
    });

    it('subMarks is empty when no starters and no subs', () => {
      expect(subMarks(addRow(emptyContent(), p7))).toEqual({});
    });

    it('removeSub deletes by index; removeRow drops subs involving that player', () => {
      let c = addSub(addSub(base(), 1, 3), 2, 4);
      expect(removeSub(c, 0).subs).toEqual([{ out: 2, in: 4, at: 2 }]);
      c = removeRow(c, 4);
      expect(c.subs).toEqual([{ out: 1, in: 3, at: 2 }]);
    });

    it('normalizeContent keeps valid subs only', () => {
      const c = normalizeContent({ subs: [{ out: 1, in: 3, at: 0 }, { out: 1, in: 1, at: 0 }, { out: 'x', in: 2, at: 0 }, null] });
      expect(c.subs).toEqual([{ out: 1, in: 3, at: 0 }]);
      expect(normalizeContent({}).subs).toEqual([]);
    });
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
    Object.freeze(c); Object.freeze(c.rows); Object.freeze(c.lineup); Object.freeze(c.liberos); Object.freeze(c.rally);
    const a = addRow(c, p7);
    Object.freeze(a); Object.freeze(a.rows); Object.freeze(a.rows[0]); Object.freeze(a.rows[0].counts);
    expect(() => {
      bumpStat(a, 7, 'atkO', 1); setLineup(a, 1, 7); setLibero(a, 0, 7); pushRally(a, 'U');
      removeRow(a, 7); bumpErrors(a, 'our', 1); popRally(a);
    }).not.toThrow();
  });
});
