// 賽事總結：賽事戰績、各場對戰、亮點、得分來源、失誤分析、各局走勢、個人表現（資料由 summarizeEvent 計算）
import { useMemo, useState } from 'react';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import {
  playerLabel,
  summarizeEvent,
  type EventSummary as Summary,
  type MatchInput,
  type MatchResult,
  type PlayerSummary,
  type Ratio,
  type Score,
  type SetSummary,
} from '@/lib/scoresheet/summary';

const fmt = (s: Score) => `${s.our}-${s.opp}`;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('space-y-3 rounded-xl border bg-card p-3', className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** 單一數值的水平長條（同一張卡共用 max，故長度可互相比較） */
function HBar({ label, value, max, total, tone = 'primary' }: {
  label: string;
  value: number;
  max: number;
  total: number;
  tone?: 'primary' | 'navy' | 'muted';
}) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-3 rounded bg-muted/60" aria-hidden>
        <div
          className={cn(
            'h-3 rounded',
            tone === 'primary' && 'bg-primary',
            tone === 'navy' && 'bg-navy',
            tone === 'muted' && 'bg-muted-foreground/40',
          )}
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="text-right tabular-nums">
        {value}
        <span className="ml-1 text-xs text-muted-foreground">{pct(value, total)}</span>
      </span>
    </div>
  );
}

const squadLabel = (q: string | null) => (q ? `${q} 隊` : null);

function ResultHeader({ m }: { m: Summary }) {
  const stat = (label: string, value: React.ReactNode, className?: string) => (
    <div className="text-center">
      <div className={cn('text-3xl font-bold tabular-nums', className)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
  return (
    <section aria-label="賽事戰績" className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-4">
      {stat(
        '對戰戰績',
        <>
          <span className="text-primary">{m.record.won}</span>
          <span className="text-base text-muted-foreground"> 勝 </span>
          <span className="text-navy">{m.record.lost}</span>
          <span className="text-base text-muted-foreground"> 負</span>
          {m.record.drawn > 0 && (
            <>
              {' '}
              {m.record.drawn}
              <span className="text-base text-muted-foreground"> 平</span>
            </>
          )}
        </>,
      )}
      {stat('局數', `${m.setsWon} : ${m.setsLost}`)}
      {stat('總得分', `${m.total.our} : ${m.total.opp}`)}
    </section>
  );
}

function MatchesCard({ m, eventId }: { m: Summary; eventId: number }) {
  return (
    <Card title={`各場對戰（${m.matches.length} 場）`}>
      <ul className="divide-y">
        {m.matches.map((r: MatchResult) => (
          <li key={r.matchLogId}>
            <Link
              to={`/match-logs/${eventId}/games/${r.matchLogId}/sheets`}
              className="flex min-h-14 items-center gap-3 py-2 hover:bg-accent/50"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">VS {r.opponent}</span>
                  {squadLabel(r.ourSquad) && <Chip size="sm" tone="outline">{squadLabel(r.ourSquad)}</Chip>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.sets.map((s) => (
                    <Chip
                      key={s.setIndex}
                      size="sm"
                      tone={s.winner === 'U' ? 'primary' : s.winner === 'O' ? 'navy' : 'outline'}
                      className="tabular-nums"
                    >
                      {fmt(s.score)}
                      {s.winner == null && s.series.length > 0 && ' 進行中'}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold tabular-nums">
                  {r.setsWon} : {r.setsLost}
                </div>
                {r.outcome && (
                  <Chip tone={r.outcome === '勝' ? 'primary' : r.outcome === '負' ? 'navy' : 'neutral'}>{r.outcome}</Chip>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">只計已打完的局；點對戰可看該場各局記錄單</p>
    </Card>
  );
}

function PointsCard({ m }: { m: Summary }) {
  const p = m.points;
  const items = [
    { label: '攻擊得分', value: p.attack },
    { label: '吊球得分', value: p.tip },
    { label: '發球得分', value: p.serve },
    { label: '攔網得分', value: p.block },
    { label: '對方失誤', value: p.oppErrors },
  ];
  const max = Math.max(...items.map((i) => i.value), p.unclassified);
  return (
    <Card title={`我方得分來源（共 ${p.total} 分）`}>
      <div className="space-y-1.5">
        {items.map((i) => (
          <HBar key={i.label} label={i.label} value={i.value} max={max} total={p.total} />
        ))}
        <HBar label="未記來源" value={p.unclassified} max={max} total={p.total} tone="muted" />
      </div>
      {p.overRecorded > 0 && (
        <p className="text-xs text-warning">表格記的得分比比分多 {p.overRecorded} 分，可能有多記或記錯格子</p>
      )}
    </Card>
  );
}

function ErrorsCard({ m }: { m: Summary }) {
  const o = m.oppPoints;
  const max = Math.max(...m.errors.map((e) => e.count), 0);
  return (
    <Card title={`對方得分來源（共 ${o.total} 分）`}>
      <div className="space-y-1.5">
        <HBar label="我方失誤" value={o.ourErrors} max={Math.max(o.ourErrors, o.earned)} total={o.total} tone="navy" />
        <HBar label="對方打下來" value={o.earned} max={Math.max(o.ourErrors, o.earned)} total={o.total} tone="navy" />
      </div>
      {o.overRecorded > 0 && (
        <p className="text-xs text-warning">我方失誤比對方得分多 {o.overRecorded} 次，可能有多記或記錯格子</p>
      )}
      <h3 className="pt-1 text-xs font-semibold text-muted-foreground">失誤分類</h3>
      {m.errors.length === 0 ? (
        <p className="text-sm text-muted-foreground">沒有記錄失誤</p>
      ) : (
        <div className="space-y-1.5">
          {m.errors.map((e) => (
            <HBar key={e.key} label={e.label} value={e.count} max={max} total={o.ourErrors} tone="navy" />
          ))}
        </div>
      )}
    </Card>
  );
}

const CHART_W = 300;
const CHART_H = 96;

/** 單局分差走勢（我方 − 對方），階梯線；暫停以虛線標示；點按顯示該分比分 */
function SetTrend({ s, idPrefix }: { s: SetSummary; idPrefix: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = s.series.length;
  const diffs = s.series.map((p) => p.our - p.opp);
  const maxAbs = Math.max(3, ...diffs.map(Math.abs));
  const mid = CHART_H / 2;
  const x = (i: number) => (n === 0 ? 0 : (i / n) * CHART_W);
  const y = (d: number) => mid - (d / maxAbs) * (mid - 6);

  // 從 0 開始的階梯：第 i 分落在 [x(i), x(i+1)] 區間
  let path = `M0 ${mid}`;
  diffs.forEach((d, i) => {
    path += ` H${x(i)} V${y(d)}`;
  });
  path += ` H${CHART_W}`;
  const area = `${path} V${mid} H0 Z`;
  const clipUp = `${idPrefix}-up-${s.setIndex}`;
  const clipDown = `${idPrefix}-down-${s.setIndex}`;

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const readout = hover != null ? s.series[hover] : null;
  const title = `第 ${s.setIndex} 局 ${fmt(s.score)}${s.winner === 'U' ? ' 勝' : s.winner === 'O' ? ' 負' : s.series.length > 0 ? ' 進行中' : ''}`;
  const run = (r: SetSummary['longestRun']['our']) => (r ? `${r.length} 分（${fmt(r.from)}→${fmt(r.to)}）` : '—');

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tabular-nums">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {readout ? `第 ${hover! + 1} 分 ${fmt(readout)}` : '點圖看比分'}
        </span>
      </div>
      {n === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">尚未記分</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-24 w-full touch-none select-none"
          role="img"
          aria-label={`${title}，最大領先 ${s.maxLead} 分，最大落後 ${s.maxDeficit} 分`}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipUp}>
              <rect x={0} y={0} width={CHART_W} height={mid} />
            </clipPath>
            <clipPath id={clipDown}>
              <rect x={0} y={mid} width={CHART_W} height={mid} />
            </clipPath>
          </defs>
          <path d={area} clipPath={`url(#${clipUp})`} className="fill-primary/20" />
          <path d={area} clipPath={`url(#${clipDown})`} className="fill-navy/20" />
          <line x1={0} x2={CHART_W} y1={mid} y2={mid} className="stroke-border" strokeWidth={1} />
          {s.timeoutMarks.map((t, i) => (
            <line
              key={i}
              x1={x(t.after)}
              x2={x(t.after)}
              y1={2}
              y2={CHART_H - 2}
              strokeDasharray="3 3"
              strokeWidth={1.5}
              className={t.side === 'U' ? 'stroke-primary' : 'stroke-navy'}
            />
          ))}
          <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-foreground/70" />
          {hover != null && (
            <line
              x1={x(hover + 0.5)}
              x2={x(hover + 0.5)}
              y1={0}
              y2={CHART_H}
              strokeWidth={1}
              className="stroke-muted-foreground"
            />
          )}
          <text x={4} y={11} className="fill-muted-foreground text-[9px]">領先</text>
          <text x={4} y={CHART_H - 4} className="fill-muted-foreground text-[9px]">落後</text>
        </svg>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs tabular-nums">
        <dt className="text-muted-foreground">我方最長連得</dt>
        <dd>{run(s.longestRun.our)}</dd>
        <dt className="text-muted-foreground">對方最長連得</dt>
        <dd>{run(s.longestRun.opp)}</dd>
        <dt className="text-muted-foreground">最大領先／落後</dt>
        <dd>
          {s.maxLead} ／ {s.maxDeficit}
        </dd>
        {s.timeouts.map((t, i) => (
          <div key={i} className="contents">
            <dt className={t.side === 'U' ? 'text-primary' : 'text-navy'}>{t.side === 'U' ? '我方暫停' : '對方暫停'}</dt>
            <dd>
              {fmt(t.at)} 時，之後{' '}
              {t.nextPoint == null ? '無得分' : `${t.nextPoint === 'U' ? '我方' : '對方'}先得分、5 分內 ${fmt(t.next5)}`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type SortKey = 'net' | 'points' | 'errors' | 'jersey';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'net', label: '淨值' },
  { key: 'points', label: '得分' },
  { key: 'errors', label: '失誤' },
  { key: 'jersey', label: '背號' },
];

function sortPlayers(list: PlayerSummary[], key: SortKey): PlayerSummary[] {
  const jersey = (p: PlayerSummary) => p.jerseyNo ?? Number.MAX_SAFE_INTEGER;
  const by: Record<SortKey, (a: PlayerSummary, b: PlayerSummary) => number> = {
    net: (a, b) => b.net - a.net || b.points - a.points,
    points: (a, b) => b.points - a.points || a.errors - b.errors,
    errors: (a, b) => b.errors - a.errors,
    jersey: (a, b) => jersey(a) - jersey(b),
  };
  return [...list].sort((a, b) => by[key](a, b) || jersey(a) - jersey(b));
}

function RatioLine({ label, r }: { label: string; r: Ratio }) {
  if (r.total === 0) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {r.made}/{r.total}（{pct(r.made, r.total)}）
      </span>
    </div>
  );
}

function PlayerCard({ p }: { p: PlayerSummary }) {
  const parts = [
    ['攻', p.pointsBy.attack],
    ['吊', p.pointsBy.tip],
    ['發', p.pointsBy.serve],
    ['攔', p.pointsBy.block],
  ].filter(([, v]) => (v as number) > 0);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-semibold">{playerLabel(p)}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          出賽 {p.setsPlayed} 局{p.setsStarted > 0 && `（先發 ${p.setsStarted}）`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xl font-bold tabular-nums text-primary">{p.points}</div>
          <div className="text-xs text-muted-foreground">得分</div>
        </div>
        <div>
          <div className="text-xl font-bold tabular-nums text-navy">{p.errors}</div>
          <div className="text-xs text-muted-foreground">失誤</div>
        </div>
        <div>
          <div className="text-xl font-bold tabular-nums">
            {p.net > 0 ? `+${p.net}` : p.net}
          </div>
          <div className="text-xs text-muted-foreground">淨值</div>
        </div>
      </div>
      {parts.length > 0 && (
        <div className="text-xs text-muted-foreground">
          得分：{parts.map(([k, v]) => `${k} ${v}`).join('・')}
        </div>
      )}
      <div className="space-y-0.5 text-xs">
        <RatioLine label="攻擊得分率" r={p.attack} />
        <RatioLine label="接發到位" r={p.reception} />
        <RatioLine label="接扣成功" r={p.dig} />
        <RatioLine label="接小到位" r={p.free} />
        <RatioLine label="修正到位" r={p.set} />
      </div>
    </div>
  );
}

function PlayersCard({ m }: { m: Summary }) {
  const [sort, setSort] = useState<SortKey>('net');
  const list = sortPlayers(m.players, sort);
  return (
    <Card title="個人表現">
      <div role="group" aria-label="排序方式" className="flex flex-wrap gap-1.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={sort === s.key}
            onClick={() => setSort(s.key)}
            className={cn(
              'h-9 rounded-full border px-3 text-sm',
              sort === s.key ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            依{s.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">沒有球員資料</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <PlayerCard key={p.playerId} p={p} />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        得分＝攻擊＋吊球＋發球＋攔網的 O；失誤＝各項 X、攻擊 no／out、接扣 未／噴、犯規；淨值＝得分 − 失誤
      </p>
    </Card>
  );
}

export function EventSummary({ matches, eventId }: { matches: MatchInput[]; eventId: number }) {
  const m = useMemo(() => summarizeEvent(matches), [matches]);
  return (
    <div className="space-y-4">
      <ResultHeader m={m} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-6">
        <MatchesCard m={m} eventId={eventId} />
        {m.highlights.length > 0 && (
          <Card title="本賽事重點">
            <ul className="space-y-1.5 text-sm">
              {m.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-6">
        <PointsCard m={m} />
        <ErrorsCard m={m} />
      </div>

      <PlayersCard m={m} />

      <Card title="各局走勢（分差：上方我方領先、下方落後；虛線為暫停）">
        <div className="space-y-4">
          {m.matches.map((r) => (
            <div key={r.matchLogId} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                VS {r.opponent}
                {squadLabel(r.ourSquad) && `（${squadLabel(r.ourSquad)}）`}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {r.sets.map((s) => (
                  <SetTrend key={s.setIndex} s={s} idPrefix={`m${r.matchLogId}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
