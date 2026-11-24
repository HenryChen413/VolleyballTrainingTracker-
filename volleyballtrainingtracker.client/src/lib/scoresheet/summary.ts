// 賽事總結：由整個賽事各對戰、各局記錄單（rally 逐分序列＋球員劃記）推算戰績、得分來源、失誤分析、各局走勢、個人表現與亮點。
// 全部為純函式，不改動傳入資料。
import { OUR_ERROR_KEYS, type StatKey } from './columns';
import { scoreOf } from './rally';
import type { RallyItem, SheetContent, SheetRow } from './sheet';
import { autoOurErrors, sumSheets } from './totals';

export interface Score {
  our: number;
  opp: number;
}

/** 連續得分：side 方連得 length 分，比分由 from 打到 to */
export interface Run {
  side: 'U' | 'O';
  length: number;
  from: Score;
  to: Score;
}

/** 暫停：叫暫停當下比分、暫停後第一分誰得、暫停後 5 分內雙方得分 */
export interface TimeoutInfo {
  side: 'U' | 'O';
  at: Score;
  nextPoint: 'U' | 'O' | null;
  next5: Score;
}

export interface SetSummary {
  setIndex: number;
  score: Score;
  /** 之後已有下一局，或依規則（第 1、2 局 25 分、第 3 局起 15 分，領先 2 分）已打完 */
  finished: boolean;
  /** 已打完時的勝方；未打完或平手為 null */
  winner: 'U' | 'O' | null;
  /** 每一分之後的累計比分（不含暫停） */
  series: Score[];
  /** 暫停發生在第幾分之後（= series 中的位置） */
  timeoutMarks: { side: 'U' | 'O'; after: number }[];
  longestRun: { our: Run | null; opp: Run | null };
  /** 我方最大領先分數（≥0） */
  maxLead: number;
  /** 我方最大落後分數（≥0） */
  maxDeficit: number;
  timeouts: TimeoutInfo[];
}

/** 與後端 ScoreSheetRules.IsSetFinished 相同 */
export function isSetFinished(setIndex: number, s: Score, hasLaterSheet: boolean): boolean {
  if (hasLaterSheet) return true;
  const target = setIndex >= 3 ? 15 : 25;
  return Math.max(s.our, s.opp) >= target && Math.abs(s.our - s.opp) >= 2;
}

function analyzeRally(rally: RallyItem[]) {
  const series: Score[] = [];
  const timeoutMarks: { side: 'U' | 'O'; after: number }[] = [];
  const points: ('U' | 'O')[] = [];
  let our = 0;
  let opp = 0;
  let maxLead = 0;
  let maxDeficit = 0;
  for (const r of rally) {
    if (r === 'U' || r === 'O') {
      if (r === 'U') our++;
      else opp++;
      points.push(r);
      series.push({ our, opp });
      maxLead = Math.max(maxLead, our - opp);
      maxDeficit = Math.max(maxDeficit, opp - our);
    } else {
      timeoutMarks.push({ side: r === 'TU' ? 'U' : 'O', after: series.length });
    }
  }

  // 最長連續得分（同長度取最早發生者）
  const best: { U: Run | null; O: Run | null } = { U: null, O: null };
  let i = 0;
  while (i < points.length) {
    let j = i;
    while (j + 1 < points.length && points[j + 1] === points[i]) j++;
    const side = points[i];
    const length = j - i + 1;
    const cur = best[side];
    if (!cur || length > cur.length) {
      best[side] = {
        side,
        length,
        from: i === 0 ? { our: 0, opp: 0 } : series[i - 1],
        to: series[j],
      };
    }
    i = j + 1;
  }

  const timeouts: TimeoutInfo[] = timeoutMarks.map(({ side, after }) => {
    const at = after === 0 ? { our: 0, opp: 0 } : series[after - 1];
    const following = points.slice(after, after + 5);
    return {
      side,
      at,
      nextPoint: following[0] ?? null,
      next5: {
        our: following.filter((p) => p === 'U').length,
        opp: following.filter((p) => p === 'O').length,
      },
    };
  });

  return { series, timeoutMarks, longestRun: { our: best.U, opp: best.O }, maxLead, maxDeficit, timeouts };
}

export function summarizeSet(setIndex: number, content: SheetContent, hasLaterSheet: boolean): SetSummary {
  const score = scoreOf(content.rally);
  const finished = content.rally.some((r) => r === 'U' || r === 'O') && isSetFinished(setIndex, score, hasLaterSheet);
  const winner = finished && score.our !== score.opp ? (score.our > score.opp ? 'U' : 'O') : null;
  return { setIndex, score, finished, winner, ...analyzeRally(content.rally) };
}

// ── 得分來源 ─────────────────────────────────────────────

export interface PointSources {
  /** rally 記下的我方總分 */
  total: number;
  attack: number;
  tip: number;
  serve: number;
  block: number;
  oppErrors: number;
  /** 比分有、表格沒記到來源的分數（≥0） */
  unclassified: number;
  /** 表格記的得分多於比分的部分（≥0，表示有多記或記錯） */
  overRecorded: number;
}

export interface OppPointSources {
  total: number;
  /** 我方失誤（格子自動加總＋手動補記） */
  ourErrors: number;
  /** 對方自己打下來的分（總分 − 我方失誤，≥0） */
  earned: number;
  /** 我方失誤多於對方總分的部分（≥0） */
  overRecorded: number;
}

// ── 失誤分析 ─────────────────────────────────────────────

export const ERROR_LABELS: Partial<Record<StatKey, string>> = {
  serveX: '發球失誤',
  atkNo: '攻擊沒進',
  atkOut: '攻擊出界',
  tipX: '吊球失誤',
  recvX: '接發失誤',
  digMiss: '接扣未接',
  digShank: '接扣噴球',
  freeX: '接小失誤',
  setX: '修正失誤',
  blockX: '攔網失誤',
  coverX: 'Cover/鬆把',
  fault: '犯規',
};

export interface ErrorItem {
  key: StatKey | 'manual';
  label: string;
  count: number;
}

// ── 個人表現 ─────────────────────────────────────────────

/** 成功數／總數；總數為 0 時 rate 為 null */
export interface Ratio {
  made: number;
  total: number;
  rate: number | null;
}

export interface PlayerSummary {
  playerId: number;
  name: string;
  jerseyNo: number | null;
  setsPlayed: number;
  setsStarted: number;
  points: number;
  pointsBy: { attack: number; tip: number; serve: number; block: number };
  errors: number;
  net: number;
  /** 攻擊得分／(得分＋沒進＋出界) */
  attack: Ratio;
  /** 接發到位／(到位＋失誤) */
  reception: Ratio;
  /** 接扣成功／(成功＋未接＋噴球) */
  dig: Ratio;
  /** 接小到位／(到位＋失誤) */
  free: Ratio;
  /** 修正到位／(到位＋失誤) */
  set: Ratio;
}

const ratio = (made: number, total: number): Ratio => ({ made, total, rate: total > 0 ? made / total : null });
const c = (r: SheetRow, k: StatKey) => r.counts[k] ?? 0;

export function summarizePlayer(row: SheetRow, setsPlayed: number, setsStarted: number): PlayerSummary {
  const pointsBy = { attack: c(row, 'atkO'), tip: c(row, 'tipO'), serve: c(row, 'serveO'), block: c(row, 'blockO') };
  const points = pointsBy.attack + pointsBy.tip + pointsBy.serve + pointsBy.block;
  const errors = OUR_ERROR_KEYS.reduce((n, k) => n + c(row, k), 0);
  return {
    playerId: row.playerId,
    name: row.name,
    jerseyNo: row.jerseyNo,
    setsPlayed,
    setsStarted,
    points,
    pointsBy,
    errors,
    net: points - errors,
    attack: ratio(c(row, 'atkO'), c(row, 'atkO') + c(row, 'atkNo') + c(row, 'atkOut')),
    reception: ratio(c(row, 'recvO'), c(row, 'recvO') + c(row, 'recvX')),
    dig: ratio(c(row, 'digO'), c(row, 'digO') + c(row, 'digMiss') + c(row, 'digShank')),
    free: ratio(c(row, 'freeO'), c(row, 'freeO') + c(row, 'freeX')),
    set: ratio(c(row, 'setO'), c(row, 'setO') + c(row, 'setX')),
  };
}

// ── 整個賽事 ─────────────────────────────────────────────

export interface MatchInput {
  matchLogId: number;
  opponent: string;
  ourSquad: string | null;
  sets: { setIndex: number; content: SheetContent }[];
}

/** 單場對戰結果 */
export interface MatchResult {
  matchLogId: number;
  opponent: string;
  ourSquad: string | null;
  sets: SetSummary[];
  /** 已打完的局中我方勝／負局數 */
  setsWon: number;
  setsLost: number;
  /** 最後一局還沒打完 */
  inProgress: boolean;
  /** 依已打完的局數判定；一局都沒打完為 null */
  outcome: '勝' | '負' | '平' | null;
  total: Score;
}

export interface EventSummary {
  matches: MatchResult[];
  /** 以對戰為單位的戰績 */
  record: { won: number; lost: number; drawn: number };
  setsWon: number;
  setsLost: number;
  total: Score;
  points: PointSources;
  oppPoints: OppPointSources;
  /** 我方失誤依類別由多到少（只列 >0 者；手動補記另列「其他」） */
  errors: ErrorItem[];
  players: PlayerSummary[];
  /** 全隊接發到位率 */
  teamReception: Ratio;
  /** 全隊攻擊得分率 */
  teamAttack: Ratio;
  highlights: string[];
}

export function summarizeMatchResult(input: MatchInput): MatchResult {
  const ordered = [...input.sets].sort((a, b) => a.setIndex - b.setIndex);
  const maxIndex = ordered.reduce((m, s) => Math.max(m, s.setIndex), 0);
  const sets = ordered.map((s) => summarizeSet(s.setIndex, s.content, s.setIndex < maxIndex));
  const finished = sets.filter((s) => s.finished);
  const setsWon = finished.filter((s) => s.winner === 'U').length;
  const setsLost = finished.filter((s) => s.winner === 'O').length;
  return {
    matchLogId: input.matchLogId,
    opponent: input.opponent,
    ourSquad: input.ourSquad,
    sets,
    setsWon,
    setsLost,
    inProgress: sets.some((s) => !s.finished && s.series.length > 0),
    outcome: finished.length === 0 ? null : setsWon > setsLost ? '勝' : setsWon < setsLost ? '負' : '平',
    total: sets.reduce((t, s) => ({ our: t.our + s.score.our, opp: t.opp + s.score.opp }), { our: 0, opp: 0 }),
  };
}

export function summarizeEvent(input: MatchInput[]): EventSummary {
  const matches = input.map(summarizeMatchResult);
  const contents = input.flatMap((m) => m.sets.map((s) => s.content));
  const totals = sumSheets(contents);

  const total = matches.reduce((t, m) => ({ our: t.our + m.total.our, opp: t.opp + m.total.opp }), { our: 0, opp: 0 });
  const sum = (k: StatKey) => totals.rows.reduce((n, r) => n + c(r, k), 0);

  const classified = sum('atkO') + sum('tipO') + sum('serveO') + sum('blockO') + totals.oppErrors;
  const points: PointSources = {
    total: total.our,
    attack: sum('atkO'),
    tip: sum('tipO'),
    serve: sum('serveO'),
    block: sum('blockO'),
    oppErrors: totals.oppErrors,
    unclassified: Math.max(0, total.our - classified),
    overRecorded: Math.max(0, classified - total.our),
  };

  const ourErrors = autoOurErrors(totals.rows) + totals.ourErrors;
  const oppPoints: OppPointSources = {
    total: total.opp,
    ourErrors,
    earned: Math.max(0, total.opp - ourErrors),
    overRecorded: Math.max(0, ourErrors - total.opp),
  };

  const errors: ErrorItem[] = OUR_ERROR_KEYS.map((k) => ({ key: k, label: ERROR_LABELS[k] ?? k, count: sum(k) }));
  if (totals.ourErrors > 0) errors.push({ key: 'manual', label: '其他（手動補記）', count: totals.ourErrors });
  const errorList = errors.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);

  // 先發局數：第一球站位或自由球員有這個人
  const started: Record<number, number> = {};
  for (const ct of contents) {
    for (const id of new Set([...ct.lineup, ...ct.liberos])) {
      if (id != null) started[id] = (started[id] ?? 0) + 1;
    }
  }
  const players = totals.rows.map((r) => summarizePlayer(r, totals.setsPlayed[r.playerId] ?? 0, started[r.playerId] ?? 0));

  const summary: EventSummary = {
    matches,
    record: {
      won: matches.filter((m) => m.outcome === '勝').length,
      lost: matches.filter((m) => m.outcome === '負').length,
      drawn: matches.filter((m) => m.outcome === '平').length,
    },
    setsWon: matches.reduce((n, m) => n + m.setsWon, 0),
    setsLost: matches.reduce((n, m) => n + m.setsLost, 0),
    total,
    points,
    oppPoints,
    errors: errorList,
    players,
    teamReception: ratio(sum('recvO'), sum('recvO') + sum('recvX')),
    teamAttack: ratio(sum('atkO'), sum('atkO') + sum('atkNo') + sum('atkOut')),
    highlights: [],
  };
  summary.highlights = buildHighlights(summary);
  return summary;
}

// ── 亮點（依規則產生的短句） ─────────────────────────────

const fmt = (s: Score) => `${s.our}-${s.opp}`;
const pct = (r: number) => `${Math.round(r * 100)}%`;
export const playerLabel = (p: { name: string; jerseyNo: number | null }) =>
  p.jerseyNo != null ? `#${p.jerseyNo} ${p.name}` : p.name;

/** 連續得分達此長度才列入亮點 */
const RUN_HIGHLIGHT = 4;
/** 落後（或領先）達此分數後逆轉才列入亮點 */
const COMEBACK_GAP = 3;

export function buildHighlights(m: EventSummary): string[] {
  const out: string[] = [];
  // 只有一個對手時不必標對手名
  const multi = m.matches.length > 1;
  const where = (match: MatchResult, s: SetSummary) =>
    multi ? `對 ${match.opponent} 第 ${s.setIndex} 局` : `第 ${s.setIndex} 局`;
  const all = m.matches.flatMap((match) => match.sets.map((s) => ({ match, s })));

  const topScorer = [...m.players].sort((a, b) => b.points - a.points)[0];
  if (topScorer && topScorer.points > 0) {
    out.push(`得分王：${playerLabel(topScorer)}，共 ${topScorer.points} 分`);
  }

  const bestBy = (side: 'our' | 'opp') =>
    all
      .map(({ match, s }) => ({ match, s, run: s.longestRun[side] }))
      .filter((x): x is typeof x & { run: Run } => x.run != null && x.run.length >= RUN_HIGHLIGHT)
      .sort((a, b) => b.run.length - a.run.length)[0];
  const bestRun = bestBy('our');
  if (bestRun) {
    out.push(`最長連續得分：${where(bestRun.match, bestRun.s)}連得 ${bestRun.run.length} 分（${fmt(bestRun.run.from)} → ${fmt(bestRun.run.to)}）`);
  }
  const worstRun = bestBy('opp');
  if (worstRun) {
    out.push(`最長連續失分：${where(worstRun.match, worstRun.s)}被連得 ${worstRun.run.length} 分（${fmt(worstRun.run.from)} → ${fmt(worstRun.run.to)}）`);
  }

  for (const { match, s } of all) {
    if (s.winner === 'U' && s.maxDeficit >= COMEBACK_GAP) {
      out.push(`${where(match, s)}最多落後 ${s.maxDeficit} 分，逆轉以 ${fmt(s.score)} 拿下`);
    } else if (s.winner === 'O' && s.maxLead >= COMEBACK_GAP) {
      out.push(`${where(match, s)}曾領先 ${s.maxLead} 分，被逆轉以 ${fmt(s.score)} 輸掉`);
    }
  }

  const topError = m.errors[0];
  if (topError && m.oppPoints.total > 0) {
    out.push(`最大失分項目：${topError.label} ${topError.count} 次（占對方得分 ${pct(topError.count / m.oppPoints.total)}）`);
  }

  if (m.points.total > 0 && m.points.oppErrors / m.points.total >= 0.4) {
    out.push(`我方得分有 ${pct(m.points.oppErrors / m.points.total)} 來自對方失誤`);
  }

  if (m.teamReception.rate != null) {
    out.push(`全隊接發到位率 ${pct(m.teamReception.rate)}（${m.teamReception.made}/${m.teamReception.total}）`);
  }

  if (m.points.total > 0 && m.points.unclassified / m.points.total >= 0.3) {
    out.push(`有 ${m.points.unclassified} 分（${pct(m.points.unclassified / m.points.total)}）沒在表格記到得分來源，統計僅供參考`);
  }

  return out;
}
