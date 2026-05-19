import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Users,
  Trophy,
  Handshake,
  Activity,
  TrendingUp,
  MapPin,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/select";
import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import {
  statsApi,
  type CategoryDistribution,
  type CategoryItem,
  type MatchEvent,
  type MatchResultLine,
  type MatchSummary,
  type RecentEvent,
} from "@/api/stats";

const YT_CHANNEL_URL = "https://youtube.com/channel/UCvONl3xCT8XLwoozldtsCcQ";

type ResultKey = "W" | "L" | "D";
const RESULT_LABEL: Record<ResultKey, string> = { W: "勝", L: "敗", D: "平" };
const RESULT_TONE: Record<ResultKey, "success" | "destructive" | "neutral"> = {
  W: "success",
  L: "destructive",
  D: "neutral",
};
const RESULT_CLASS: Record<ResultKey, string> = {
  W: "text-success font-semibold",
  L: "text-destructive font-semibold",
  D: "text-muted-foreground font-semibold",
};
const MATCH_TYPE_LABEL: Record<string, string> = {
  Official: "比賽",
  Friendly: "友誼賽",
};
const MATCH_TYPE_TONE: Record<string, "info" | "warning"> = {
  Official: "info",
  Friendly: "warning",
};

export default function DashboardPage() {
  const [distMonths, setDistMonths] = useState(6);
  const { data: overview, isLoading: lo } = useQuery({
    queryKey: ["stats", "overview"],
    queryFn: () => statsApi.overview(),
  });
  const { data: distribution, isLoading: ld } = useQuery({
    queryKey: ["stats", "categoryDistribution", distMonths],
    queryFn: () => statsApi.categoryDistribution(distMonths),
  });
  const { data: matchSummary, isLoading: lm } = useQuery({
    queryKey: ["stats", "matchSummary"],
    queryFn: () => statsApi.matchSummary(),
  });
  const { data: recentEvents, isLoading: lr } = useQuery({
    queryKey: ["stats", "recentEvents"],
    queryFn: () => statsApi.recentEvents(5),
  });

  const yearLabel =
    overview?.latestAcademicYear != null
      ? `${overview.latestAcademicYear} 學年度`
      : "尚無資料";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">儀表板</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            球隊整體狀態與近期動態
          </p>
        </div>
        <Chip tone="primary" size="lg" className="font-display shrink-0">
          <Calendar className="h-3.5 w-3.5" />
          {yearLabel}
        </Chip>
      </div>

      {/* YouTube banner */}
      <Card className="surface-soft border-primary/20 overflow-hidden">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-destructive/10 text-destructive shrink-0">
            <YoutubeIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">YouTube 頻道</div>
            <div className="text-sm text-muted-foreground truncate">
              訂閱頻道,觀看訓練與比賽影片
            </div>
          </div>
          <a
            href={YT_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center h-10 px-4 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0 shadow-soft"
          >
            前往頻道
          </a>
        </CardContent>
      </Card>

      {/* Hero KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        {lo ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              title="現役選手"
              value={overview?.activePlayerCount ?? "-"}
              suffix="人"
              icon={Users}
              tone="primary"
            />
            <StatCard
              title="比賽次數"
              value={overview?.officialEventCount ?? "-"}
              suffix="項"
              icon={Trophy}
              tone="info"
              subtitle={yearLabel}
            />
            <StatCard
              title="友誼賽次數"
              value={overview?.friendlyEventCount ?? "-"}
              suffix="項"
              icon={Handshake}
              tone="warning"
              subtitle={yearLabel}
            />
          </>
        )}
      </div>

      {/* 訓練分布 */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">訓練分布</CardTitle>
              <CardDescription>技術面向比重（不含基礎、體能）</CardDescription>
            </div>
            <Select
              className="h-9 w-28"
              value={distMonths}
              onChange={(e) => setDistMonths(Number(e.target.value))}
            >
              <option value={3}>近 3 個月</option>
              <option value={6}>近 6 個月</option>
              <option value={12}>近 12 個月</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {ld ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <DistributionRadar data={distribution} />
          )}
        </CardContent>
      </Card>

      {/* 戰績區 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">戰績總覽</CardTitle>
            <CardDescription>
              {yearLabel} · 僅統計比賽（Official）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lm ? (
              <Skeleton className="h-60 w-full" />
            ) : matchSummary && matchSummary.eventCount > 0 ? (
              <MatchSummaryBody summary={matchSummary} />
            ) : (
              <EmptyState title="本學年度尚無比賽紀錄" icon={Trophy} compact />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">近 5 場</CardTitle>
            <CardDescription>最新 5 個賽事大項目（含友誼賽）</CardDescription>
          </CardHeader>
          <CardContent>
            {lr ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : recentEvents && recentEvents.length > 0 ? (
              <ul className="divide-y">
                {recentEvents.map((e, i) => (
                  <RecentEventRow key={i} e={e} />
                ))}
              </ul>
            ) : (
              <EmptyState title="尚無比賽紀錄" icon={Trophy} compact />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============== StatCard ============== */

type Tone = "primary" | "info" | "warning" | "success" | "destructive";
const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
};
const TONE_ACCENT: Record<Tone, string> = {
  primary: "from-primary/8 via-primary/0 to-transparent",
  info: "from-info/8 via-info/0 to-transparent",
  warning: "from-warning/10 via-warning/0 to-transparent",
  success: "from-success/8 via-success/0 to-transparent",
  destructive: "from-destructive/8 via-destructive/0 to-transparent",
};

interface StatCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  trend?: number;
  compact?: boolean;
}

function StatCard({
  title,
  value,
  suffix,
  subtitle,
  icon: Icon,
  tone = "primary",
  trend,
  compact,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all hover:shadow-lift hover:-translate-y-0.5",
        "bg-gradient-to-br",
        TONE_ACCENT[tone],
      )}
    >
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                "font-display font-bold tracking-tight mt-1.5 text-foreground",
                compact ? "text-xl" : "text-3xl",
              )}
            >
              <span className="font-numeric">
                {typeof value === "number" ? (
                  <AnimatedNumber value={value} />
                ) : (
                  value
                )}
              </span>
              {suffix && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {suffix}
                </span>
              )}
            </p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
            {trend != null && (
              <p
                className={cn(
                  "text-xs mt-2 inline-flex items-center gap-1 font-medium",
                  trend >= 0 ? "text-success" : "text-destructive",
                )}
              >
                <TrendingUp
                  className={cn("h-3 w-3", trend < 0 && "rotate-180")}
                />
                {Math.abs(trend)}%
              </p>
            )}
          </div>
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              TONE_BG[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== 戰績總覽 ============== */

function MatchSummaryBody({ summary }: { summary: MatchSummary }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          共{" "}
          <span className="font-numeric font-bold text-foreground text-base mx-0.5">
            {summary.eventCount}
          </span>{" "}
          項比賽
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {summary.events.map((e, i) => (
            <RankingCard key={i} event={e} />
          ))}
        </div>
      </div>

      <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 -mr-1">
        {summary.events.map((e, i) => (
          <EventBlock key={i} event={e} />
        ))}
      </ul>
    </div>
  );
}

function RankingCard({ event }: { event: MatchEvent }) {
  const title = event.matchName?.trim() || "（未命名賽事）";
  const isSplit = event.squadCount >= 2;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card/50 p-3">
      <p className="text-sm font-medium leading-snug line-clamp-2" title={title}>
        {title}
      </p>
      {isSplit ? (
        <div className="mt-auto flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">A 名次</span>
            {event.ranking ? (
              <Chip tone="primary" size="sm">
                {event.ranking}
              </Chip>
            ) : (
              <span className="text-muted-foreground italic">未評定</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">B 名次</span>
            {event.rankingB ? (
              <Chip tone="info" size="sm">
                {event.rankingB}
              </Chip>
            ) : (
              <span className="text-muted-foreground italic">未評定</span>
            )}
          </span>
        </div>
      ) : (
        <span className="mt-auto inline-flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">名次</span>
          {event.ranking ? (
            <Chip tone="navy" size="sm">
              {event.ranking}
            </Chip>
          ) : (
            <span className="text-muted-foreground italic">未評定</span>
          )}
        </span>
      )}
    </div>
  );
}

function tallySquad(lines: MatchResultLine[], squad: string) {
  let w = 0,
    l = 0,
    d = 0;
  for (const ln of lines) {
    if (ln.ourSquad !== squad) continue;
    if (ln.result === "W") w++;
    else if (ln.result === "L") l++;
    else if (ln.result === "D") d++;
  }
  return { w, l, d };
}

const SQUAD_TONE: Record<string, "primary" | "info"> = {
  A: "primary",
  B: "info",
};

function EventBlock({ event }: { event: MatchEvent }) {
  const title = event.matchName?.trim() || "（未命名賽事）";
  const isSplit = event.squadCount >= 2;
  return (
    <li className="rounded-lg border bg-card/50 p-3 hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="h-3 w-3" />
            <span className="font-numeric">{event.matchDate.slice(0, 10)}</span>
            {event.location && (
              <>
                <span>·</span>
                <MapPin className="h-3 w-3" />
                <span className="truncate">{event.location}</span>
              </>
            )}
          </div>
        </div>
        {!isSplit && event.ranking && (
          <Chip tone="navy" className="shrink-0">
            {event.ranking}
          </Chip>
        )}
      </div>

      {isSplit && (
        <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <SquadSummary squad="A" lines={event.lines} ranking={event.ranking} />
          <SquadSummary
            squad="B"
            lines={event.lines}
            ranking={event.rankingB}
          />
        </div>
      )}

      <ul className="space-y-1">
        {event.lines.map((line, i) => (
          <ResultLine key={i} line={line} showSquad={isSplit} />
        ))}
      </ul>
    </li>
  );
}

function SquadSummary({
  squad,
  lines,
  ranking,
}: {
  squad: "A" | "B";
  lines: MatchResultLine[];
  ranking: string | null;
}) {
  const t = tallySquad(lines, squad);
  const total = t.w + t.l + t.d;
  if (total === 0 && !ranking) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs">
      <Chip tone={SQUAD_TONE[squad]} size="sm">
        {squad} 隊
      </Chip>
      <span className="font-numeric text-muted-foreground">
        <span className="text-success">{t.w}</span>
        <span className="mx-0.5">·</span>
        <span className="text-destructive">{t.l}</span>
        {t.d > 0 && (
          <>
            <span className="mx-0.5">·</span>
            <span>{t.d}</span>
          </>
        )}
      </span>
      {ranking && (
        <Chip tone="navy" size="sm" className="ml-auto">
          {ranking}
        </Chip>
      )}
    </div>
  );
}

function ResultLine({
  line,
  showSquad,
}: {
  line: MatchResultLine;
  showSquad: boolean;
}) {
  const score =
    line.ourScore != null && line.opponentScore != null
      ? `${line.ourScore}:${line.opponentScore}`
      : "-";
  const result = line.result as ResultKey | null;
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="truncate text-muted-foreground flex items-center gap-1.5">
        {showSquad && line.ourSquad && (
          <Chip tone={SQUAD_TONE[line.ourSquad] ?? "neutral"} size="sm">
            {line.ourSquad}
          </Chip>
        )}
        <span>
          vs <span className="text-foreground">{line.opponent}</span>
        </span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            "font-numeric",
            result ? RESULT_CLASS[result] : "text-muted-foreground",
          )}
        >
          {score}
        </span>
        {result && (
          <Chip tone={RESULT_TONE[result]} size="sm">
            {RESULT_LABEL[result]}
          </Chip>
        )}
      </div>
    </li>
  );
}

function RecentEventRow({ e }: { e: RecentEvent }) {
  const title = e.matchName?.trim() || "（未命名賽事）";
  const typeKey = e.matchType ?? "";
  const isSplit = e.squadCount >= 2;
  return (
    <li className="py-2.5 flex items-start justify-between gap-3 hover:bg-accent/30 -mx-2 px-2 rounded-md transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {typeKey && (
            <Chip tone={MATCH_TYPE_TONE[typeKey] ?? "neutral"} size="sm">
              {MATCH_TYPE_LABEL[typeKey] ?? typeKey}
            </Chip>
          )}
          {isSplit && (
            <Chip tone="primary" size="sm">
              分隊出賽
            </Chip>
          )}
          <span className="text-xs text-muted-foreground font-numeric">
            {e.matchDate.slice(0, 10)}
          </span>
        </div>
        <div className="font-medium truncate">{title}</div>
        {e.location && (
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {e.location}
          </div>
        )}
      </div>
      {e.ranking && (
        <Chip tone="navy" className="shrink-0 self-center">
          {e.ranking}
        </Chip>
      )}
    </li>
  );
}

/* ============== 訓練分布 ============== */

function DistributionRadar({
  data,
}: {
  data: CategoryDistribution | undefined;
}) {
  if (!data || data.total === 0)
    return <EmptyState title="尚無訓練動作紀錄" icon={Activity} />;

  const chartData = data.categories.map((c) => ({
    label: c.label,
    count: c.count,
    percent: c.percent,
  }));
  return (
    <div className="space-y-4">
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer initialDimension={{ width: 300, height: 320 }}>
          <RadarChart data={chartData} outerRadius="75%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }}
            />
            <PolarRadiusAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              allowDecimals={false}
              stroke="hsl(var(--border))"
            />
            <Radar
              name="次數"
              dataKey="count"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                color: "hsl(var(--popover-foreground))",
                fontSize: "12px",
              }}
              formatter={(value, _name, item) => {
                const pct =
                  (item?.payload as { percent?: number } | undefined)
                    ?.percent ?? 0;
                return [`${value} 次（${pct}%）`, "訓練分布"];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.categories.map((c) => (
          <CategoryDetailCard key={c.key} item={c} />
        ))}
      </div>

      {(data.basicCount > 0 || data.fitnessCount > 0) && (
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          另含 基礎{" "}
          <span className="text-foreground font-numeric font-medium">
            {data.basicCount}
          </span>{" "}
          次、 體能{" "}
          <span className="text-foreground font-numeric font-medium">
            {data.fitnessCount}
          </span>{" "}
          次（未計入分布）
        </div>
      )}
    </div>
  );
}

function CategoryDetailCard({ item }: { item: CategoryItem }) {
  return (
    <div className="rounded-lg border bg-card p-3 hover:border-primary/40 hover:shadow-soft transition-all">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-medium">{item.label}</span>
        <span className="text-sm font-numeric">
          <span className="font-bold">{item.count}</span>
          <span className="text-xs text-muted-foreground ml-1">
            ({item.percent}%)
          </span>
        </span>
      </div>
      {/* progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-2.5">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${Math.min(item.percent, 100)}%` }}
        />
      </div>
      {item.drills.length > 0 ? (
        <ul className="space-y-1">
          {item.drills.slice(0, 5).map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate text-muted-foreground">{d.name}</span>
              <span className="shrink-0 font-numeric">{d.count}</span>
            </li>
          ))}
          {item.drills.length > 5 && (
            <li className="text-[10px] text-muted-foreground text-center pt-1">
              還有 {item.drills.length - 5} 項…
            </li>
          )}
        </ul>
      ) : (
        <div className="text-xs text-muted-foreground">尚無動作</div>
      )}
    </div>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  );
}
