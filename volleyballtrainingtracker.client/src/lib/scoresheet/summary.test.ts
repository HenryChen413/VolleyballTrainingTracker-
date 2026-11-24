import { describe, it, expect } from 'vitest';
import { emptyContent, type RallyItem, type SheetContent, type SheetRow } from './sheet';
import { isSetFinished, summarizeEvent, summarizeMatchResult, summarizePlayer, summarizeSet, type MatchInput } from './summary';

const rally = (s: string): RallyItem[] =>
  s.split(' ').filter(Boolean).map((t) => t as RallyItem);

const sheet = (r: RallyItem[], extra: Partial<SheetContent> = {}): SheetContent => ({ ...emptyContent(), rally: r, ...extra });

/** 單一對手的賽事 */
const one = (sets: { setIndex: number; content: SheetContent }[], opponent = '甲隊', matchLogId = 1): MatchInput => ({
  matchLogId,
  opponent,
  ourSquad: null,
  sets,
});

/** 重點攤平成一行字串，方便比對：label｜text｜note */
const flat = (hs: { label: string; text: string; note?: string }[]) =>
  hs.map((h) => [h.label, h.text, h.note].filter(Boolean).join('｜'));

const row = (playerId: number, counts: SheetRow['counts'], jerseyNo: number | null = playerId): SheetRow => ({
  playerId,
  name: `P${playerId}`,
  jerseyNo,
  counts,
});

describe('isSetFinished', () => {
  it('later sheet means finished', () => {
    expect(isSetFinished(1, { our: 3, opp: 2 }, true)).toBe(true);
  });
  it('sets 1-2 need 25 with 2-point lead; set 3+ needs 15', () => {
    expect(isSetFinished(1, { our: 25, opp: 23 }, false)).toBe(true);
    expect(isSetFinished(2, { our: 25, opp: 24 }, false)).toBe(false);
    expect(isSetFinished(3, { our: 15, opp: 10 }, false)).toBe(true);
    expect(isSetFinished(3, { our: 14, opp: 10 }, false)).toBe(false);
  });
});

describe('summarizeSet', () => {
  it('series, max lead/deficit and longest runs', () => {
    // 0-1 0-2 0-3 1-3 2-3 3-3 4-3 5-3
    const s = summarizeSet(1, sheet(rally('O O O U U U U U')), true);
    expect(s.score).toEqual({ our: 5, opp: 3 });
    expect(s.series).toHaveLength(8);
    expect(s.maxDeficit).toBe(3);
    expect(s.maxLead).toBe(2);
    expect(s.longestRun.our).toEqual({ side: 'U', length: 5, from: { our: 0, opp: 3 }, to: { our: 5, opp: 3 } });
    expect(s.longestRun.opp).toEqual({ side: 'O', length: 3, from: { our: 0, opp: 0 }, to: { our: 0, opp: 3 } });
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('U');
  });

  it('earliest run wins ties', () => {
    const s = summarizeSet(1, sheet(rally('U U O U U')), true);
    expect(s.longestRun.our?.to).toEqual({ our: 2, opp: 0 });
  });

  it('timeouts record position, next point and next 5 points', () => {
    const s = summarizeSet(1, sheet(rally('O O TU U U O U U U')), true);
    expect(s.timeoutMarks).toEqual([{ side: 'U', after: 2 }]);
    expect(s.timeouts).toEqual([
      { side: 'U', at: { our: 0, opp: 2 }, nextPoint: 'U', next5: { our: 4, opp: 1 } },
    ]);
  });

  it('timeout at the very start and at the end', () => {
    const s = summarizeSet(1, sheet(rally('TO U TU')), true);
    expect(s.timeouts[0].at).toEqual({ our: 0, opp: 0 });
    expect(s.timeouts[1]).toEqual({ side: 'U', at: { our: 1, opp: 0 }, nextPoint: null, next5: { our: 0, opp: 0 } });
  });

  it('unfinished last set has no winner; empty rally is not finished', () => {
    expect(summarizeSet(2, sheet(rally('U U')), false)).toMatchObject({ finished: false, winner: null });
    expect(summarizeSet(1, sheet([]), true)).toMatchObject({ finished: false, winner: null, longestRun: { our: null, opp: null } });
  });
});

describe('summarizePlayer', () => {
  it('points, errors, net and ratios', () => {
    const p = summarizePlayer(
      row(7, { atkO: 6, atkNo: 4, atkOut: 3, tipO: 1, serveO: 2, serveX: 1, blockO: 1, recvO: 8, recvX: 2, fault: 1 }),
      3,
      2,
    );
    expect(p.points).toBe(10);
    expect(p.pointsBy).toEqual({ attack: 6, tip: 1, serve: 2, block: 1 });
    expect(p.errors).toBe(4 + 3 + 1 + 2 + 1);
    expect(p.net).toBe(10 - 11);
    expect(p.attack).toEqual({ made: 6, total: 13, rate: 6 / 13 });
    expect(p.reception).toEqual({ made: 8, total: 10, rate: 0.8 });
    expect(p.dig.rate).toBeNull();
    expect(p.setsPlayed).toBe(3);
    expect(p.setsStarted).toBe(2);
  });
});

describe('summarizeEvent (single opponent)', () => {
  const s1 = sheet([...Array(25).fill('U'), ...Array(20).fill('O')] as RallyItem[], {
    lineup: [1, 2, null, null, null, null],
    rows: [row(1, { atkO: 10, serveX: 3 }), row(2, { serveO: 2, recvX: 1 })],
    oppErrors: 8,
    ourErrors: 1,
  });
  const s2 = sheet([...Array(10).fill('O'), ...Array(5).fill('U')] as RallyItem[], {
    lineup: [1, null, null, null, null, null],
    rows: [row(1, { atkO: 2, atkOut: 4 }), row(3, { blockO: 1 })],
    oppErrors: 1,
  });

  it('tallies finished sets only, totals and in-progress flag', () => {
    const m = summarizeEvent([one([{ setIndex: 2, content: s2 }, { setIndex: 1, content: s1 }])]);
    const r = m.matches[0];
    expect(r.sets.map((s) => s.setIndex)).toEqual([1, 2]);
    expect(r).toMatchObject({ setsWon: 1, setsLost: 0, inProgress: true, outcome: '勝' });
    expect(m.setsWon).toBe(1);
    expect(m.record).toEqual({ won: 1, lost: 0, drawn: 0 });
    expect(m.total).toEqual({ our: 30, opp: 30 });
  });

  it('point sources with unclassified remainder', () => {
    const m = summarizeEvent([one([{ setIndex: 1, content: s1 }, { setIndex: 2, content: s2 }])]);
    expect(m.points).toEqual({ total: 30, attack: 12, tip: 0, serve: 2, block: 1, oppErrors: 9, unclassified: 6, overRecorded: 0 });
  });

  it('opponent points split into our errors (auto + manual) and earned', () => {
    const m = summarizeEvent([one([{ setIndex: 1, content: s1 }, { setIndex: 2, content: s2 }])]);
    // 自動：serveX 3 + recvX 1 + atkOut 4 = 8；手動 1
    expect(m.oppPoints).toEqual({ total: 30, ourErrors: 9, earned: 21, overRecorded: 0 });
  });

  it('over-recorded when table exceeds score', () => {
    const m = summarizeEvent([one([{ setIndex: 1, content: sheet(rally('U'), { rows: [row(1, { atkO: 3 })] }) }])]);
    expect(m.points.unclassified).toBe(0);
    expect(m.points.overRecorded).toBe(2);
  });

  it('errors sorted desc with manual extras', () => {
    const m = summarizeEvent([one([{ setIndex: 1, content: s1 }, { setIndex: 2, content: s2 }])]);
    expect(m.errors.map((e) => [e.label, e.count])).toEqual([
      ['攻擊出界', 4],
      ['發球失誤', 3],
      ['接發失誤', 1],
      ['其他（手動補記）', 1],
    ]);
  });

  it('players merged across sets with sets played / started', () => {
    const m = summarizeEvent([one([{ setIndex: 1, content: s1 }, { setIndex: 2, content: s2 }])]);
    const p1 = m.players.find((p) => p.playerId === 1)!;
    expect(p1).toMatchObject({ setsPlayed: 2, setsStarted: 2, points: 12 });
    expect(m.players.find((p) => p.playerId === 3)).toMatchObject({ setsPlayed: 1, setsStarted: 0 });
  });

  it('highlights: top scorer, runs, top error, opp-error share', () => {
    const m = summarizeEvent([one([{ setIndex: 1, content: s1 }, { setIndex: 2, content: s2 }])]);
    expect(flat(m.highlights)).toContain('得分王｜#1 P1，共 12 分');
    expect(flat(m.highlights)).toContain('最長連續得分｜第 1 局連得 25 分｜0-0 → 25-0');
    expect(flat(m.highlights)).toContain('最長連續失分｜第 1 局被連得 20 分｜25-0 → 25-20');
    expect(flat(m.highlights).some((h) => h.startsWith('最大失分項目｜攻擊出界 4 次'))).toBe(true);
  });

  it('highlights comeback and blown lead', () => {
    const comeback = sheet(rally('O O O O U U U U U'));
    const blown = sheet(rally('U U U U O O O O O'));
    const m = summarizeEvent([one([{ setIndex: 1, content: comeback }, { setIndex: 2, content: blown }, { setIndex: 3, content: sheet([]) }])]);
    expect(flat(m.highlights)).toContain('逆轉勝｜第 1 局最多落後 4 分｜5-4 拿下');
    expect(flat(m.highlights)).toContain('被逆轉｜第 2 局曾領先 4 分｜4-5 輸掉');
  });

  it('highlights warn when many points are unclassified', () => {
    const m = summarizeEvent([one([{ setIndex: 1, content: sheet(rally('U U U O')) }])]);
    expect(flat(m.highlights)).toContain('記錄提醒｜有 3 分沒在表格記到得分來源，統計僅供參考｜占 100%');
  });

  it('empty input', () => {
    const m = summarizeEvent([]);
    expect(m).toMatchObject({ setsWon: 0, setsLost: 0, matches: [], players: [], highlights: [], record: { won: 0, lost: 0, drawn: 0 } });
  });
});

describe('summarizeEvent (multiple opponents)', () => {
  const win = sheet([...Array(25).fill('U'), ...Array(20).fill('O')] as RallyItem[], {
    rows: [row(1, { atkO: 5 })],
  });
  const loss = sheet([...Array(15).fill('U'), ...Array(25).fill('O')] as RallyItem[], {
    rows: [row(1, { atkO: 2 }), row(2, { serveX: 2 })],
  });
  const comeback = sheet(rally('O O O O U U U U U'));

  it('record counts matches, sets and points across opponents', () => {
    const m = summarizeEvent([
      one([{ setIndex: 1, content: win }, { setIndex: 2, content: win }], '甲隊', 1),
      one([{ setIndex: 1, content: loss }, { setIndex: 2, content: loss }], '乙隊', 2),
      one([{ setIndex: 1, content: win }, { setIndex: 2, content: loss }], '丙隊', 3),
    ]);
    expect(m.matches.map((x) => [x.opponent, x.outcome])).toEqual([['甲隊', '勝'], ['乙隊', '負'], ['丙隊', '平']]);
    expect(m.record).toEqual({ won: 1, lost: 1, drawn: 1 });
    expect(m.setsWon).toBe(3);
    expect(m.setsLost).toBe(3);
    expect(m.total).toEqual({ our: 25 * 3 + 15 * 3, opp: 20 * 3 + 25 * 3 });
    // 球員跨對手合併
    expect(m.players.find((p) => p.playerId === 1)).toMatchObject({ setsPlayed: 6, points: 5 * 3 + 2 * 3 });
  });

  it('highlights name the opponent when there are several', () => {
    const m = summarizeEvent([
      one([{ setIndex: 1, content: win }], '甲隊', 1),
      one([{ setIndex: 1, content: comeback }, { setIndex: 2, content: sheet([]) }], '乙隊', 2),
    ]);
    expect(flat(m.highlights)).toContain('最長連續得分｜對 甲隊 第 1 局連得 25 分｜0-0 → 25-0');
    expect(flat(m.highlights)).toContain('逆轉勝｜對 乙隊 第 1 局最多落後 4 分｜5-4 拿下');
  });

  it('match with no finished set has no outcome', () => {
    expect(summarizeMatchResult(one([{ setIndex: 1, content: sheet(rally('U U')) }])).outcome).toBeNull();
  });
});
