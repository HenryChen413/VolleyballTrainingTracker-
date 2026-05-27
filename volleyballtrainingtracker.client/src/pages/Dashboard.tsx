import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  MapPin,
  Calendar,
  BookOpen,
  Cake,
  Volleyball,
  Crown,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import UserGuideDialog from "@/components/UserGuideDialog";
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
import {
  playersApi,
  MEMBER_TYPE,
  PLAYER_STATUS,
  type Player,
} from "@/api/players";
import {
  sponsorsApi,
  SPONSOR_IDENTITY_LABEL,
  type SponsorRank,
} from "@/api/sponsors";
import { cryingApi, type CryingPlayerRank } from "@/api/crying";
import { PAGE, useAuthStore } from "@/stores/authStore";

const YT_CHANNEL_URL = "https://youtube.com/channel/UCvONl3xCT8XLwoozldtsCcQ";
const IG_URL = "https://www.instagram.com/kmumed_gvb/";

type ResultKey = "W" | "L" | "D";
const RESULT_LABEL: Record<ResultKey, string> = { W: "勝", L: "敗", D: "平" };
const RESULT_TONE: Record<ResultKey, "success" | "destructive" | "neutral"> = {
  W: "success",
  L: "destructive",
  D: "neutral",
};
const MATCH_TYPE_LABEL: Record<string, string> = {
  Official: "比賽",
  Friendly: "友誼賽",
};
const MATCH_TYPE_TONE: Record<string, "info" | "warning"> = {
  Official: "info",
  Friendly: "warning",
};

// 名次字串配色：冠/亞/季 視覺較顯眼用 warning（金黃），其他用 navy。
function rankingTone(label: string | null | undefined): "warning" | "navy" {
  if (!label) return "navy";
  if (/冠軍|亞軍|季軍/.test(label)) return "warning";
  return "navy";
}

function formatMoneyShort(n: number): string {
  return `$${(n ?? 0).toLocaleString("en-US")}`;
}

// 顯示用日期格式：YYYY/MM/DD（從 ISO 字串切出前 10 碼）
function fmtDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "/");
}

// 顯示用日期格式：MM/DD（從 ISO 字串切出 5~10 碼）
function fmtShortDate(iso: string): string {
  return iso.slice(5, 10).replace(/-/g, "/");
}

/* ============== 共用小元件：RankNumeral / ProgressBar ============== */

function RankNumeral({
  rank,
  className,
}: {
  rank: number;
  className?: string;
}) {
  const color =
    rank === 1
      ? "text-[hsl(var(--gold))]"
      : rank === 2
        ? "text-[hsl(var(--silver))]"
        : rank === 3
          ? "text-[hsl(var(--bronze))]"
          : "text-muted-foreground";
  return (
    <span
      className={cn("font-numeric font-bold tabular-nums", color, className)}
    >
      {rank}
    </span>
  );
}

type BarTone = "primary" | "warning" | "info" | "success";
const BAR_FILL: Record<BarTone, string> = {
  primary: "bg-primary",
  warning: "bg-warning",
  info: "bg-info",
  success: "bg-success",
};

function ProgressBar({
  value,
  max,
  tone = "primary",
  className,
}: {
  value: number;
  max: number;
  tone?: BarTone;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={cn(
        "h-1.5 w-full rounded-full bg-muted overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          BAR_FILL[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ============== 主元件 ============== */

export default function DashboardPage() {
  const navigate = useNavigate();
  const [distMonths, setDistMonths] = useState(6);
  const [guideOpen, setGuideOpen] = useState(false);

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

  const { data: activeStaff } = useQuery({
    queryKey: ["players", "activeStaffCounts"],
    queryFn: () => playersApi.list({ activeOnly: true }),
  });
  const coachCount = (activeStaff ?? []).filter(
    (p) => p.memberType === MEMBER_TYPE.Coach,
  ).length;
  const managerCount = (activeStaff ?? []).filter(
    (p) => p.memberType === MEMBER_TYPE.Manager,
  ).length;

  const canSeeSponsors = useAuthStore((s) => s.canAccess)(PAGE.Sponsors);
  const { data: sponsorStats } = useQuery({
    queryKey: ["sponsor-stats", "dashboard-top3"],
    queryFn: () => sponsorsApi.stats({ top: 3 }),
    enabled: canSeeSponsors,
  });
  const topSponsors = sponsorStats?.topSponsors ?? [];
  const showSponsorKpi = canSeeSponsors && topSponsors.length > 0;

  const canSeeCrying = useAuthStore((s) => s.canAccess)(PAGE.Crying);
  const { data: cryingStats } = useQuery({
    queryKey: ["crying-stats"],
    queryFn: () => cryingApi.stats({ top: 10 }),
    enabled: canSeeCrying,
  });

  const yearLabel =
    overview?.latestAcademicYear != null
      ? `${overview.latestAcademicYear} 學年度`
      : "尚無資料";

  return (
    <div className="space-y-6">
      {/* === 1. Page Header（含 eyebrow 小標、學年度 chip） === */}
      <PageHeader
        yearLabel={yearLabel}
        onGuideOpen={() => setGuideOpen(true)}
      />

      <UserGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* === 2. Hero KPI strip（贊助榜 / 現役選手 / 賽事統計） === */}
      <section
        className={cn(
          "grid gap-5",
          showSponsorKpi
            ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            : "grid-cols-1 md:grid-cols-2",
        )}
      >
        {showSponsorKpi && <SponsorTop3Card sponsors={topSponsors} />}
        {lo ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <ActivePlayersCard
              count={overview?.activePlayerCount ?? 0}
              coachCount={coachCount}
              managerCount={managerCount}
            />
            <MatchStatsCard
              official={overview?.officialEventCount ?? 0}
              friendly={overview?.friendlyEventCount ?? 0}
              yearLabel={yearLabel}
            />
          </>
        )}
      </section>

      {/* === 3. 社群連結（橫排式 Card） === */}
      <SocialLinks />

      {/* === 4. 哭哭/加分榜 並排 === */}
      {canSeeCrying && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <LeaderboardCard
            title="哭哭王 TOP 3"
            subtitle="本學年度累計次數"
            tone="info"
            icon={Crown}
            rows={(cryingStats?.topCriers ?? []).map((r) => ({
              key: `${r.kind}-${r.playerId ?? r.name}`,
              name: r.name,
              sub: r.jerseyNo != null ? `#${r.jerseyNo}` : "",
              count: r.count,
            }))}
            onOverflowClick={() => navigate("/crying")}
          />
          <LeaderboardCard
            title="加分王 TOP 3"
            subtitle="本學年度累計次數"
            tone="warning"
            icon={Trophy}
            rows={(cryingStats?.topScorers ?? []).map(
              (r: CryingPlayerRank) => ({
                key: `${r.kind}-${r.playerId ?? r.name}`,
                name: r.name,
                sub:
                  r.kind === "external"
                    ? "(外)"
                    : r.jerseyNo != null
                      ? `#${r.jerseyNo}`
                      : "",
                count: r.count,
              }),
            )}
            onOverflowClick={() => navigate("/crying")}
          />
        </section>
      )}

      {/* === 5. 本月壽星 === */}
      <BirthdayCard />

      {/* === 6. 訓練分布（雷達左、詳情卡右；5/7 split on lg+） === */}
      <Card className="surface-soft">
        <CardContent className="p-5 lg:p-6">
          <CardSectionHeader
            tone="primary"
            icon={Clock}
            title="訓練分布"
            subtitle="技術面向比重（不含基礎、體能）"
            right={<PeriodPicker value={distMonths} onChange={setDistMonths} />}
          />
          {ld ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <DistributionBody data={distribution} />
          )}
        </CardContent>
      </Card>

      {/* === 7. 戰績區（7/5 split on xl） === */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7">
          <Card className="surface-soft h-full">
            <CardContent className="p-5 lg:p-6 flex flex-col h-full">
              <CardSectionHeader
                tone="warning"
                icon={Trophy}
                title="戰績總覽"
                subtitle={`${yearLabel} · 僅統計比賽（Official）`}
                accent={
                  matchSummary && matchSummary.eventCount > 0 ? (
                    <Chip tone="warning" size="sm">
                      共
                      <span className="font-numeric font-semibold mx-0.5">
                        {matchSummary.eventCount}
                      </span>
                      項
                    </Chip>
                  ) : null
                }
              />
              {lm ? (
                <Skeleton className="h-60 w-full" />
              ) : matchSummary && matchSummary.eventCount > 0 ? (
                <ResultsOverviewBody summary={matchSummary} />
              ) : (
                <EmptyState
                  title="本學年度尚無比賽紀錄"
                  icon={Trophy}
                  compact
                />
              )}
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-5">
          <Card className="surface-soft h-full">
            <CardContent className="p-5 lg:p-6 flex flex-col h-full">
              <CardSectionHeader
                tone="info"
                icon={Clock}
                title="近 5 場"
                subtitle="最新 5 個賽事大項目（含友誼賽）"
                accent={
                  <Chip tone="info" size="sm">
                    含友誼
                  </Chip>
                }
              />
              {lr ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : recentEvents && recentEvents.length > 0 ? (
                <ul className="divide-y divide-border flex-1">
                  {recentEvents.map((e, i) => (
                    <RecentEventRow key={e.id ?? i} e={e} />
                  ))}
                </ul>
              ) : (
                <EmptyState title="尚無比賽紀錄" icon={Trophy} compact />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

/* ============== Page Header ============== */

function PageHeader({
  yearLabel,
  onGuideOpen,
}: {
  yearLabel: string;
  onGuideOpen: () => void;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[32px] sm:text-[40px] leading-[1.05] tracking-tight font-bold">
          儀表板
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          球隊整體狀態與近期動態
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onGuideOpen}>
          <BookOpen className="h-4 w-4 mr-1.5" />
          使用說明
        </Button>
        <Chip tone="primary" size="lg" className="font-display">
          <Calendar className="h-3.5 w-3.5" />
          {yearLabel}
        </Chip>
      </div>
    </header>
  );
}

/* ============== 共用 CardSectionHeader（icon + title + subtitle + accent + right） ============== */

type Tone = "primary" | "info" | "warning" | "success" | "navy";
const TONE_ICON_BG: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/10 text-success",
  navy: "bg-navy/10 text-navy",
};

function CardSectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "primary",
  accent,
  right,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  tone?: Tone;
  accent?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-4", className)}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "shrink-0 grid place-items-center w-9 h-9 rounded-lg",
            TONE_ICON_BG[tone],
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            {accent}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ============== Hero KPI Cards ============== */

function SponsorTop3Card({ sponsors }: { sponsors: SponsorRank[] }) {
  return (
    <Card className="surface-soft transition-all hover:shadow-lift hover:-translate-y-0.5">
      <CardContent className="p-5 lg:p-6">
        <CardSectionHeader
          tone="warning"
          icon={Crown}
          title="贊助榜 TOP 3"
          subtitle="本學年度累計金額"
        />
        <ul className="space-y-2.5">
          {sponsors.slice(0, 3).map((s, idx) => (
            <li key={s.sponsorId} className="flex items-center gap-3 py-1.5">
              <RankNumeral
                rank={idx + 1}
                className="text-[20px] w-6 text-center"
              />
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                {s.jerseyNo != null && (
                  <span className="font-numeric text-[11.5px] text-muted-foreground shrink-0">
                    #{s.jerseyNo}
                  </span>
                )}
                <span className="text-sm text-foreground truncate">
                  {s.displayName}
                </span>
                <Chip tone="outline" size="sm" className="shrink-0">
                  {SPONSOR_IDENTITY_LABEL[s.identity] ?? ""}
                </Chip>
              </div>
              <span className="font-numeric font-semibold text-sm text-warning shrink-0">
                {formatMoneyShort(s.totalAmount)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ActivePlayersCard({
  count,
  coachCount,
  managerCount,
}: {
  count: number;
  coachCount: number;
  managerCount: number;
}) {
  return (
    <Card className="surface-soft relative overflow-hidden transition-all hover:shadow-lift hover:-translate-y-0.5">
      <div
        className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-[0.08] blur-2xl bg-primary pointer-events-none"
        aria-hidden
      />
      <CardContent className="p-5 lg:p-6 relative">
        <CardSectionHeader
          tone="primary"
          icon={Users}
          title="現役選手"
          subtitle="球隊核心成員"
        />
        <div className="flex items-end gap-2 mt-2">
          <span className="font-display font-bold text-[56px] leading-none tracking-tight text-foreground">
            <span className="font-numeric">
              <AnimatedNumber value={count} />
            </span>
          </span>
          <span className="text-sm text-muted-foreground mb-2">人</span>
        </div>
        {(coachCount > 0 || managerCount > 0) && (
          <div className="flex items-center gap-2 mt-4">
            <Chip tone="navy" size="md">
              教練{" "}
              <span className="font-numeric font-semibold ml-1">
                {coachCount}
              </span>
            </Chip>
            <Chip tone="info" size="md">
              球經{" "}
              <span className="font-numeric font-semibold ml-1">
                {managerCount}
              </span>
            </Chip>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchStatsCard({
  official,
  friendly,
  yearLabel,
}: {
  official: number;
  friendly: number;
  yearLabel: string;
}) {
  const lines: {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    tagLabel: string;
    tagTone: "info" | "warning";
  }[] = [
    {
      label: "比賽",
      value: official,
      icon: Trophy,
      tagLabel: "Official",
      tagTone: "info",
    },
    {
      label: "友誼賽",
      value: friendly,
      icon: Handshake,
      tagLabel: "Friendly",
      tagTone: "warning",
    },
  ];
  return (
    <Card className="surface-soft transition-all hover:shadow-lift hover:-translate-y-0.5">
      <CardContent className="p-5 lg:p-6">
        <CardSectionHeader
          tone="info"
          icon={Trophy}
          title="賽事統計"
          subtitle="本學年度出賽次數"
        />
        <div className="space-y-3 mt-1">
          {lines.map((ln, i) => (
            <div key={ln.label}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "grid place-items-center w-7 h-7 rounded-md shrink-0",
                      ln.tagTone === "info"
                        ? "bg-info/10 text-info"
                        : "bg-warning/15 text-warning",
                    )}
                  >
                    <ln.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm text-foreground">{ln.label}</span>
                  <Chip tone={ln.tagTone} size="sm" className="shrink-0">
                    {ln.tagLabel}
                  </Chip>
                </div>
                <div className="font-numeric font-bold text-[22px] text-foreground">
                  <AnimatedNumber value={ln.value} />
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    項
                  </span>
                </div>
              </div>
              {i === 0 && <div className="h-px bg-border mt-3" />}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-dashed border-border flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {yearLabel}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== 社群連結 ============== */

function SocialLinks() {
  return (
    <Card className="surface-soft border-primary/20 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex items-center gap-3 md:w-[260px] shrink-0">
            <div className="grid place-items-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
              <Volleyball className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[15px]">社群連結</div>
              <div className="text-[12.5px] text-muted-foreground mt-0.5">
                訂閱頻道、追蹤動態
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-0">
            <a
              href={YT_CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2.5 h-12 px-4 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all hover:-translate-y-0.5 shadow-soft"
            >
              <YoutubeIcon className="h-5 w-5" />
              YouTube 頻道
            </a>
            <a
              href={IG_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2.5 h-12 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-soft"
            >
              <InstagramIcon className="h-5 w-5" />
              Instagram
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== 哭哭/加分榜 LeaderboardCard ============== */

interface LeaderRow {
  key: string;
  name: string;
  sub?: string;
  count: number;
}

function LeaderboardCard({
  title,
  subtitle,
  tone,
  icon,
  rows,
  onOverflowClick,
}: {
  title: string;
  subtitle: string;
  tone: "info" | "warning";
  icon: React.ComponentType<{ className?: string }>;
  rows: LeaderRow[];
  onOverflowClick?: () => void;
}) {
  // 標準競技排名（1224）：同分同名次、下一名次跳號
  const ordered = [...rows].sort((a, b) => b.count - a.count);
  const ranked: (LeaderRow & { rank: number })[] = [];
  let prevCount: number | null = null;
  let rank = 0;
  ordered.forEach((r, i) => {
    if (prevCount === null || r.count !== prevCount) rank = i + 1;
    prevCount = r.count;
    ranked.push({ ...r, rank });
  });
  const top = ranked.filter((r) => r.rank <= 3);

  // 同名次並列 > 2 人時，僅顯示前 2 位，其餘累計到 overflow
  const visible: (LeaderRow & { rank: number })[] = [];
  const overflow: Record<number, number> = {};
  const seenPerRank: Record<number, number> = {};
  for (const r of top) {
    seenPerRank[r.rank] = (seenPerRank[r.rank] || 0) + 1;
    const totalAtRank = top.filter((t) => t.rank === r.rank).length;
    if (totalAtRank > 2 && seenPerRank[r.rank] > 2) {
      overflow[r.rank] = (overflow[r.rank] || 0) + 1;
    } else {
      visible.push(r);
    }
  }
  const overflowRanks = Object.keys(overflow).map(Number);
  const maxValue = Math.max(...rows.map((r) => r.count), 1);

  return (
    <Card className="surface-soft h-full">
      <CardContent className="p-5 lg:p-6 flex flex-col h-full">
        <CardSectionHeader
          tone={tone}
          icon={icon}
          title={title}
          subtitle={subtitle}
          accent={
            <Chip tone={tone} size="sm">
              TOP 3
            </Chip>
          }
        />
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">尚無資料</p>
        ) : (
          <ul className="space-y-0.5 flex-1">
            {visible.map((r) => (
              <li
                key={r.key}
                className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-2 px-1 rounded-md hover:bg-muted/60 transition-colors"
              >
                <RankNumeral
                  rank={r.rank}
                  className="text-[18px] text-center"
                />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-foreground truncate">
                    {r.name}
                  </span>
                  {r.sub && (
                    <span className="font-numeric text-[11.5px] text-muted-foreground shrink-0">
                      {r.sub}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-16 hidden sm:block">
                    <ProgressBar value={r.count} max={maxValue} tone={tone} />
                  </div>
                  <span className="font-numeric font-bold text-base text-foreground tabular-nums w-7 text-right">
                    {r.count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {overflowRanks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-1">
            {overflowRanks.map((rk) => (
              <button
                key={rk}
                type="button"
                onClick={onOverflowClick}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
              >
                並列第{rk} · 還有{" "}
                <span className="font-numeric font-semibold">
                  {overflow[rk]}
                </span>{" "}
                人
                <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============== 本月壽星 ============== */

interface BirthdayStar {
  player: Player;
  monthNum: number;
  dayNum: number;
  age: number;
  isToday: boolean;
}

function BirthdayCard() {
  const { data: players, isLoading } = useQuery({
    queryKey: ["players", "birthdayActiveAll"],
    queryFn: () => playersApi.list({ activeOnly: true }),
  });

  const now = new Date();
  const curMonth = String(now.getMonth() + 1).padStart(2, "0");
  const curDay = String(now.getDate()).padStart(2, "0");
  const curYear = now.getFullYear();
  const curMonthNum = Number(curMonth);

  const memberTypeOrder = (t: number) =>
    t === MEMBER_TYPE.Player ? 0 : t === MEMBER_TYPE.Coach ? 1 : 2;

  const stars: BirthdayStar[] = (players ?? [])
    .filter(
      (p) =>
        p.isActive === PLAYER_STATUS.Active &&
        !!p.birthDate &&
        p.birthDate.slice(5, 7) === curMonth,
    )
    .map((p) => {
      const month = p.birthDate!.slice(5, 7);
      const day = p.birthDate!.slice(8, 10);
      const year = Number(p.birthDate!.slice(0, 4));
      return {
        player: p,
        monthNum: Number(month),
        dayNum: Number(day),
        age: curYear - year,
        isToday: month === curMonth && day === curDay,
      };
    })
    .sort((a, b) => {
      const ord =
        memberTypeOrder(a.player.memberType) -
        memberTypeOrder(b.player.memberType);
      if (ord !== 0) return ord;
      return a.dayNum - b.dayNum;
    });

  return (
    <Card className="surface-soft">
      <CardContent className="p-5 lg:p-6">
        <CardSectionHeader
          tone="primary"
          icon={Cake}
          title="本月壽星"
          subtitle={`${curMonthNum} 月過生日的現役隊員`}
          accent={
            stars.length > 0 ? (
              <Chip tone="primary" size="sm">
                <span className="font-numeric font-semibold">
                  {stars.length}
                </span>{" "}
                位
              </Chip>
            ) : null
          }
        />
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : stars.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stars.map((s) => (
              <BirthdayRow key={s.player.id} star={s} />
            ))}
          </div>
        ) : (
          <EmptyState title="本月沒有壽星" icon={Cake} compact />
        )}
      </CardContent>
    </Card>
  );
}

function BirthdayRow({ star }: { star: BirthdayStar }) {
  const { player, monthNum, dayNum, age, isToday } = star;
  const displayName = player.nickname?.trim() || player.name;
  const isPlayer = player.memberType === MEMBER_TYPE.Player;
  const isCoach = player.memberType === MEMBER_TYPE.Coach;
  return (
    <div
      className={cn(
        "relative rounded-lg p-3.5 border transition-all hover:-translate-y-0.5",
        isToday
          ? "border-primary/50 bg-primary/5 shadow-glow"
          : "border-border bg-card hover:shadow-soft hover:border-primary/40",
      )}
    >
      {isToday && (
        <span className="absolute -top-2 left-3 text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground whitespace-nowrap">
          今天 🎂
        </span>
      )}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={cn(
            "text-[15px] font-semibold truncate min-w-0",
            isToday ? "text-primary" : "text-foreground",
          )}
        >
          {isToday && <span className="mr-1">🎂</span>}
          {displayName}
        </span>
        {isPlayer && player.jerseyNo != null ? (
          <Chip tone="outline" size="sm" className="shrink-0">
            <span className="font-numeric">#{player.jerseyNo}</span>
          </Chip>
        ) : !isPlayer ? (
          <Chip tone={isCoach ? "navy" : "info"} size="sm" className="shrink-0">
            {isCoach ? "教練" : "球經"}
          </Chip>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>
          <span className="font-numeric">{monthNum}</span> 月{" "}
          <span className="font-numeric">{dayNum}</span> 日
        </span>
        <span className="opacity-50">·</span>
        <span>
          滿{" "}
          <span className="font-numeric font-semibold text-foreground">
            {age}
          </span>{" "}
          歲
        </span>
      </div>
    </div>
  );
}

/* ============== 訓練分布 ============== */

function PeriodPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const opts = [
    { v: 3, label: "近 3 個月" },
    { v: 6, label: "近 6 個月" },
    { v: 12, label: "近 12 個月" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "h-7 px-2.5 text-[11.5px] font-medium rounded-md transition-colors whitespace-nowrap",
            value === o.v
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DistributionBody({
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
  const totalDrill = data.categories.reduce((s, c) => s + c.count, 0);
  const totalMax = Math.max(...data.categories.map((c) => c.count), 1);
  const topCat = [...data.categories].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* 雷達圖 */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer initialDimension={{ width: 300, height: 300 }}>
              <RadarChart data={chartData} outerRadius="72%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                />
                <PolarRadiusAxis
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
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
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Chip tone="primary" size="md">
              總計{" "}
              <span className="font-numeric font-semibold ml-1">
                {totalDrill}
              </span>{" "}
              次
            </Chip>
            {topCat && topCat.count > 0 && (
              <Chip tone="warning" size="md">
                最多 · {topCat.label}{" "}
                <span className="font-numeric font-semibold ml-1">
                  {Math.round(topCat.percent)}%
                </span>
              </Chip>
            )}
          </div>
        </div>

        {/* 分類詳情卡 */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.categories.map((c) => (
              <CategoryDetailCard key={c.key} item={c} totalMax={totalMax} />
            ))}
          </div>
        </div>
      </div>

      {(data.basicCount > 0 || data.fitnessCount > 0) && (
        <div className="pt-4 border-t border-dashed border-border text-center text-[12.5px] text-muted-foreground">
          另含 基礎{" "}
          <span className="font-numeric font-semibold text-foreground">
            {data.basicCount}
          </span>{" "}
          次、體能{" "}
          <span className="font-numeric font-semibold text-foreground">
            {data.fitnessCount}
          </span>{" "}
          次（未計入分布）
        </div>
      )}
    </div>
  );
}

function CategoryDetailCard({
  item,
  totalMax,
}: {
  item: CategoryItem;
  totalMax: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-soft transition-all">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">
            {item.label}
          </span>
          {item.count === 0 && (
            <Chip tone="outline" size="sm">
              無動作
            </Chip>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-numeric font-bold text-[17px] text-foreground">
            {item.count}
          </span>
          <span className="font-numeric text-[11.5px] text-muted-foreground">
            ({item.percent}%)
          </span>
        </div>
      </div>
      <ProgressBar
        value={item.count}
        max={totalMax}
        tone="primary"
        className="mb-3"
      />
      {item.drills.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground italic mt-3">
          尚無動作
        </p>
      ) : (
        <ul className="space-y-1.5">
          {item.drills.slice(0, 5).map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-[12.5px]"
            >
              <span className="text-foreground/80 truncate">{d.name}</span>
              <span className="font-numeric font-medium text-muted-foreground tabular-nums">
                {d.count}
              </span>
            </li>
          ))}
          {item.drills.length > 5 && (
            <li className="text-[11.5px] text-muted-foreground italic pt-0.5">
              還有{" "}
              <span className="font-numeric font-semibold">
                {item.drills.length - 5}
              </span>{" "}
              項…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ============== 戰績總覽 ============== */

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

function tallyAll(lines: MatchResultLine[]) {
  let w = 0,
    l = 0,
    d = 0;
  for (const ln of lines) {
    if (ln.result === "W") w++;
    else if (ln.result === "L") l++;
    else if (ln.result === "D") d++;
  }
  return { w, l, d };
}

function recordString(t: { w: number; l: number; d: number }) {
  return t.d > 0 ? `${t.w}-${t.l}-${t.d}` : `${t.w}-${t.l}`;
}

function ResultsOverviewBody({ summary }: { summary: MatchSummary }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top: 名次小卡 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
        {summary.events.map((e, i) => (
          <EventRankingCard key={i} event={e} />
        ))}
      </div>
      {/* 滾動列表 */}
      <ul className="space-y-3 overflow-y-auto pr-1 -mr-1 flex-1 max-h-[420px]">
        {summary.events.map((e, i) => (
          <EventDetailBlock key={i} event={e} />
        ))}
      </ul>
    </div>
  );
}

function EventRankingCard({ event }: { event: MatchEvent }) {
  const title = event.matchName?.trim() || "（未命名賽事）";
  const isSplit = event.squadCount >= 2;
  const shortDate = fmtShortDate(event.matchDate);
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 hover:-translate-y-0.5 hover:shadow-soft transition-all">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <h4
          className="text-sm font-semibold text-foreground leading-tight line-clamp-2"
          title={title}
        >
          {title}
        </h4>
        <Chip tone="outline" size="sm" className="font-numeric shrink-0">
          {shortDate}
        </Chip>
      </div>
      {!isSplit ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            名次
          </span>
          {event.ranking ? (
            <Chip tone={rankingTone(event.ranking)} size="md">
              {event.ranking}
            </Chip>
          ) : (
            <span className="text-xs text-muted-foreground italic">未評定</span>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md bg-muted/50 px-2 py-1.5 flex items-center justify-between gap-1.5 min-w-0">
            <Chip tone="primary" size="sm" className="shrink-0">
              A
            </Chip>
            {event.ranking ? (
              <Chip
                tone={rankingTone(event.ranking)}
                size="sm"
                className="truncate"
              >
                {event.ranking}
              </Chip>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">
                未評定
              </span>
            )}
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-1.5 flex items-center justify-between gap-1.5 min-w-0">
            <Chip tone="info" size="sm" className="shrink-0">
              B
            </Chip>
            {event.rankingB ? (
              <Chip
                tone={rankingTone(event.rankingB)}
                size="sm"
                className="truncate"
              >
                {event.rankingB}
              </Chip>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">
                未評定
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EventDetailBlock({ event }: { event: MatchEvent }) {
  const title = event.matchName?.trim() || "（未命名賽事）";
  const isSplit = event.squadCount >= 2;
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold text-foreground">{title}</h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="font-numeric">{fmtDate(event.matchDate)}</span>
            </span>
            {event.location && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </span>
              </>
            )}
          </div>
        </div>
        {!isSplit ? (
          event.ranking && (
            <Chip
              tone={rankingTone(event.ranking)}
              size="md"
              className="shrink-0 font-semibold"
            >
              {event.ranking}
            </Chip>
          )
        ) : (
          <div className="flex gap-1.5 shrink-0">
            {event.ranking && (
              <Chip tone={rankingTone(event.ranking)} size="sm">
                <span className="opacity-70 mr-0.5">A</span>
                {event.ranking}
              </Chip>
            )}
            {event.rankingB && (
              <Chip tone={rankingTone(event.rankingB)} size="sm">
                <span className="opacity-70 mr-0.5">B</span>
                {event.rankingB}
              </Chip>
            )}
          </div>
        )}
      </div>

      {/* 分隊計分板（W-L-D 動態算） */}
      {isSplit && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <SquadRecord squad="A" lines={event.lines} tone="primary" />
          <SquadRecord squad="B" lines={event.lines} tone="info" />
        </div>
      )}
      {!isSplit && (
        <div className="mb-3">
          <SingleRecord lines={event.lines} />
        </div>
      )}

      {/* 對戰結果列表 */}
      <ul className="divide-y divide-border/70">
        {event.lines.map((m, i) => (
          <ResultLineRow key={i} line={m} showSquad={isSplit} />
        ))}
      </ul>
    </li>
  );
}

function SquadRecord({
  squad,
  lines,
  tone,
}: {
  squad: "A" | "B";
  lines: MatchResultLine[];
  tone: "primary" | "info";
}) {
  const t = tallySquad(lines, squad);
  const total = t.w + t.l + t.d;
  if (total === 0) return null;
  return (
    <div
      className={cn(
        "rounded-md px-2.5 py-1.5 flex items-center justify-between",
        tone === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-info/10 text-info",
      )}
    >
      <span className="text-[11.5px] font-semibold">{squad} 隊</span>
      <span className="font-numeric font-bold text-sm tabular-nums">
        {recordString(t)}
      </span>
    </div>
  );
}

function SingleRecord({ lines }: { lines: MatchResultLine[] }) {
  const t = tallyAll(lines);
  const total = t.w + t.l + t.d;
  if (total === 0) return null;
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-1.5 flex items-center justify-between text-foreground">
      <span className="text-[11.5px] font-semibold text-muted-foreground">
        戰績
      </span>
      <span className="font-numeric font-bold text-sm tabular-nums">
        <span className="text-success">{t.w}</span>
        <span className="mx-0.5 text-muted-foreground">-</span>
        <span className="text-destructive">{t.l}</span>
        {t.d > 0 && (
          <>
            <span className="mx-0.5 text-muted-foreground">-</span>
            <span className="text-muted-foreground">{t.d}</span>
          </>
        )}
      </span>
    </div>
  );
}

function ResultLineRow({
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
    <li className="flex items-center gap-3 py-2 text-[13px]">
      {showSquad && line.ourSquad && (
        <span
          className={cn(
            "shrink-0 grid place-items-center w-5 h-5 rounded text-[10px] font-bold",
            line.ourSquad === "A"
              ? "bg-primary/10 text-primary"
              : "bg-info/10 text-info",
          )}
        >
          {line.ourSquad}
        </span>
      )}
      <span className="flex-1 text-foreground truncate">
        <span className="text-muted-foreground mr-1">vs</span>
        {line.opponent}
      </span>
      <span className="font-numeric font-bold text-sm text-foreground tabular-nums shrink-0">
        {score}
      </span>
      {result && (
        <Chip tone={RESULT_TONE[result]} size="sm" className="shrink-0">
          {RESULT_LABEL[result]}
        </Chip>
      )}
    </li>
  );
}

/* ============== 近 5 場 ============== */

function RecentEventRow({ e }: { e: RecentEvent }) {
  const [open, setOpen] = useState(false);
  const title = e.matchName?.trim() || "（未命名賽事）";
  const typeKey = e.matchType ?? "";
  const isSplit = e.squadCount >= 2;
  const hasLines = e.lines && e.lines.length > 0;

  return (
    <li className="group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-3 py-3.5 px-1 cursor-pointer transition-colors text-left",
          "hover:bg-muted/50 rounded-md -mx-1",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        )}
      >
        <div className="flex flex-col items-start gap-1 shrink-0 w-[110px]">
          <div className="flex items-center gap-1 flex-wrap">
            {typeKey && (
              <Chip tone={MATCH_TYPE_TONE[typeKey] ?? "neutral"} size="sm">
                {MATCH_TYPE_LABEL[typeKey] ?? typeKey}
              </Chip>
            )}
            {isSplit && (
              <Chip tone="warning" size="sm">
                分隊
              </Chip>
            )}
          </div>
          <span className="font-numeric text-[11.5px] text-muted-foreground whitespace-nowrap">
            {fmtDate(e.matchDate)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14.5px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {title}
          </h4>
          {e.location && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{e.location}</span>
            </div>
          )}
        </div>
        {e.ranking && (
          <Chip
            tone={rankingTone(e.ranking)}
            size="md"
            className="font-semibold shrink-0"
          >
            {e.ranking}
          </Chip>
        )}
      </button>
      {open && (
        <div className="pl-3 pr-1 pb-3 -mt-1">
          {hasLines ? (
            <>
              {isSplit ? (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <SquadRecord squad="A" lines={e.lines} tone="primary" />
                  <SquadRecord squad="B" lines={e.lines} tone="info" />
                </div>
              ) : (
                <div className="mb-2">
                  <SingleRecord lines={e.lines} />
                </div>
              )}
              <ul className="divide-y divide-border/70">
                {e.lines.map((m, i) => (
                  <ResultLineRow key={i} line={m} showSquad={isSplit} />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic py-2">
              尚無對戰結果
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/* ============== 社群圖示（自製 SVG，保留品牌色） ============== */

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

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
