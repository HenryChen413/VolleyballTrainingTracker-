import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus, ChevronRight, ChevronDown, Video, Pencil, Trophy,
  MapPin, Users, Search, StickyNote, X, Download,
} from "lucide-react";
import {
  matchEventsApi,
  type MatchEventListItem,
  type MatchLogItem,
} from "@/api/matchLogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { RosterChip } from "@/components/RosterChip";
import { groupByPrimaryPosition } from "@/lib/positions";
import { PERM, useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { exportCsv, datedFilename } from "@/lib/exportCsv";

type ResultKey = "W" | "L" | "D";
const RESULT_LABEL: Record<ResultKey, string> = { W: "勝", L: "敗", D: "平" };
const RESULT_TONE: Record<ResultKey, "success" | "destructive" | "neutral"> = {
  W: "success", L: "destructive", D: "neutral",
};
const MATCH_TYPE_LABEL: Record<string, string> = { Official: "比賽", Friendly: "友誼賽" };
const MATCH_TYPE_TONE: Record<string, "info" | "warning"> = { Official: "info", Friendly: "warning" };

function tally(items: MatchLogItem[]) {
  let w = 0, l = 0, d = 0;
  for (const it of items) {
    if (it.result === "W") w++;
    else if (it.result === "L") l++;
    else if (it.result === "D") d++;
  }
  return { w, l, d };
}

// 整場賽事的主導結果 → 卡片左側細邊框配色
function eventEdgeClass(t: { w: number; l: number; d: number }, totalMatches: number) {
  if (totalMatches === 0) return "border-l-muted-foreground/20";
  if (t.w === totalMatches) return "border-l-success";
  if (t.l === totalMatches) return "border-l-destructive";
  if (t.w > t.l) return "border-l-success/60";
  if (t.l > t.w) return "border-l-destructive/60";
  return "border-l-warning";
}

// ── 主元件 ────────────────────────────────────────────────────────────
export default function MatchLogsPage() {
  const navigate = useNavigate();
  const canCreate = useAuthStore((s) => s.can(PERM.MatchLogsEdit));
  const canUpdate = canCreate;
  const { data, isLoading } = useQuery({
    queryKey: ["match-events"],
    queryFn: () => matchEventsApi.list(),
  });
  const events = useMemo<MatchEventListItem[]>(() => data ?? [], [data]);

  const [yearFilter, setYearFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const e of events) if (e.academicYear != null) set.add(e.academicYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (yearFilter !== "all" && String(e.academicYear ?? "") !== yearFilter) return false;
      if (typeFilter !== "all" && (e.matchType ?? "") !== typeFilter) return false;
      if (q) {
        const hay = [
          e.matchName ?? "",
          e.location ?? "",
          e.matches.map((m) => m.opponent).join(" "),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, yearFilter, typeFilter, search]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const hasActiveFilter =
    yearFilter !== "all" || typeFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setYearFilter("all"); setTypeFilter("all"); setSearch("");
  };

  // CSV 匯出：依目前篩選結果，每筆對戰一列；無對戰的賽事仍輸出一列
  const handleExport = () => {
    const header = [
      "日期", "學年", "類型", "賽事名稱", "地點", "名次",
      "對手", "我方分隊", "局1我", "局1敵", "局2我", "局2敵",
      "局3我", "局3敵", "我方總分", "對方總分", "結果",
    ];
    const resultLabel = (r: string | null) =>
      r === "W" ? "勝" : r === "L" ? "敗" : r === "D" ? "平" : "";
    const rows = filtered.flatMap((e) => {
      const base = [
        e.matchDate.slice(0, 10),
        e.academicYear ?? "",
        MATCH_TYPE_LABEL[e.matchType ?? ""] ?? e.matchType ?? "",
        e.matchName ?? "",
        e.location ?? "",
        e.ranking ?? "",
      ];
      if (e.matches.length === 0) {
        return [[...base, ...Array(11).fill("")]];
      }
      return e.matches.map((m) => [
        ...base,
        m.opponent,
        m.ourSquad ?? "",
        m.set1Our ?? "", m.set1Opp ?? "",
        m.set2Our ?? "", m.set2Opp ?? "",
        m.set3Our ?? "", m.set3Opp ?? "",
        m.ourScore ?? "", m.opponentScore ?? "",
        resultLabel(m.result),
      ]);
    });
    exportCsv(datedFilename("match-logs"), [header, ...rows]);
  };

  return (
    <div className="space-y-5">
      {/* 頁首 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">比賽紀錄</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            檢視每一場賽事的對戰結果、出賽名單與比分細節
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filtered.length === 0}
            title="匯出目前篩選結果為 CSV"
          >
            <Download className="h-4 w-4 mr-1" /> 匯出
          </Button>
          {canCreate && (
            <Button onClick={() => navigate("/match-logs/new")}>
              <Plus className="h-4 w-4 mr-1" /> 新增比賽
            </Button>
          )}
        </div>
      </div>

      {/* 篩選列 */}
      {!isLoading && events.length > 0 && (
        <FilterBar
          availableYears={availableYears}
          year={yearFilter} onYearChange={setYearFilter}
          type={typeFilter} onTypeChange={setTypeFilter}
          search={search} onSearchChange={setSearch}
          totalEvents={events.length}
          filteredEvents={filtered.length}
          hasActiveFilter={hasActiveFilter}
          onClear={clearFilters}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <Card className="p-6 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      )}

      {/* 空：完全無資料 */}
      {!isLoading && events.length === 0 && (
        <Card>
          <EmptyState
            title="尚無比賽紀錄"
            description={canCreate ? "點擊右上「新增比賽」開始記錄第一場賽事" : undefined}
            icon={Trophy}
          />
        </Card>
      )}

      {/* 空：篩選後 */}
      {!isLoading && events.length > 0 && filtered.length === 0 && (
        <Card>
          <EmptyState
            title="沒有符合條件的賽事"
            description="試著放寬篩選條件或清除"
            icon={Search}
            action={<Button variant="outline" size="sm" onClick={clearFilters}>清除篩選</Button>}
          />
        </Card>
      )}

      {/* 賽事列表 */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((g) => {
            const open = expanded.has(g.id);
            const t = tally(g.matches);
            const isSplit = g.squadCount >= 2;
            const edge = eventEdgeClass(t, g.matches.length);
            return (
              <Card
                key={g.id}
                className={cn(
                  "overflow-hidden border-l-4 transition-all",
                  edge,
                  open ? "ring-1 ring-primary/30 shadow-lift" : "hover:shadow-lift hover:-translate-y-px",
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(g.id);
                    }
                  }}
                  className="w-full cursor-pointer text-left flex flex-col sm:flex-row sm:items-stretch hover:bg-accent/30 transition-colors"
                >
                  {/* 飽和日期條：MM/DD ↘ YYYY ↘ {AY}學年 */}
                  <div className="bg-navy text-navy-foreground px-4 py-3 sm:min-w-[120px] flex sm:flex-col items-center justify-center gap-2 sm:gap-0.5">
                    <div className="text-2xl font-bold leading-tight font-display tabular-nums">
                      {g.matchDate.slice(5, 7)}/{g.matchDate.slice(8, 10)}
                    </div>
                    <div className="text-sm opacity-85 font-numeric tabular-nums leading-tight">
                      {g.matchDate.slice(0, 4)}
                    </div>
                    {g.academicYear != null && (
                      <div className="text-[11px] opacity-65 font-numeric tabular-nums leading-tight">
                        {g.academicYear} 學年
                      </div>
                    )}
                  </div>

                  {/* 中：標題與資訊 */}
                  <div className="flex-1 px-4 py-3 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {g.matchType && (
                        <Chip tone={MATCH_TYPE_TONE[g.matchType] ?? "neutral"} size="sm">
                          {MATCH_TYPE_LABEL[g.matchType] ?? g.matchType}
                        </Chip>
                      )}
                      {isSplit ? (
                        <>
                          {g.ranking && <Chip tone="primary" size="sm">A：{g.ranking}</Chip>}
                          {g.rankingB && <Chip tone="info" size="sm">B：{g.rankingB}</Chip>}
                          <Chip tone="navy" size="sm">分隊出賽</Chip>
                        </>
                      ) : (
                        g.ranking && <Chip tone="navy" size="sm">{g.ranking}</Chip>
                      )}
                    </div>
                    <h3 className="font-semibold text-base truncate">
                      {g.matchName || "（未命名賽事）"}
                    </h3>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      {g.location && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />{g.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 font-numeric">
                        <Trophy className="h-3 w-3" /> {g.matches.length} 場
                      </span>
                      {g.playerCount > 0 && (
                        <span className="inline-flex items-center gap-1 font-numeric">
                          <Users className="h-3 w-3" /> {g.playerCount} 人
                        </span>
                      )}
                      {g.videoUrl && (
                        <a
                          href={g.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Video className="h-3 w-3" /> 影片
                        </a>
                      )}
                    </div>
                    {g.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 truncate inline-flex items-center gap-1">
                        <StickyNote className="h-3 w-3 shrink-0" />
                        <span className="truncate">{g.notes}</span>
                      </p>
                    )}
                  </div>

                  {/* 右：主導戰績徽章 + 操作 */}
                  <div className="px-4 py-3 flex items-center gap-3 sm:border-l border-t sm:border-t-0 border-border">
                    <ResultDonut w={t.w} l={t.l} d={t.d} totalMatches={g.matches.length} />
                    <div className="flex items-center gap-1 shrink-0">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/match-logs/${g.id}`);
                          }}
                          title="編輯"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {open ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* 展開區 */}
                {open && (
                  <div className="border-t bg-muted/30 px-4 py-4 animate-slide-up space-y-5">
                    {g.players.length > 0 && (
                      <RosterSection players={g.players} squadCount={g.squadCount} />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-semibold">對戰紀錄</h4>
                        <Chip tone="outline" size="sm">{g.matches.length}</Chip>
                      </div>
                      {g.matches.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic py-4">尚未填寫對戰</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {g.matches.map((item) => (
                            <MatchScoreCard key={item.id} item={item} isSplit={isSplit} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// conic-gradient donut（卡片戰績圓環內部使用）
function DonutCircle({
  rate, w, l, d, size = 48,
}: {
  rate: number; w: number; l: number; d: number; size?: number;
}) {
  const total = w + l + d;
  if (total === 0) {
    return (
      <div
        className="rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px]"
        style={{ width: size, height: size }}
      >
        —
      </div>
    );
  }
  const wPct = (w / total) * 100;
  const lPct = (l / total) * 100;
  const bg = `conic-gradient(hsl(var(--success)) 0 ${wPct}%, hsl(var(--destructive)) ${wPct}% ${wPct + lPct}%, hsl(var(--muted-foreground)) ${wPct + lPct}% 100%)`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="rounded-full" style={{ width: size, height: size, background: bg }} />
      <div
        className="absolute rounded-full bg-card flex items-center justify-center"
        style={{ inset: 5 }}
      >
        <span className="text-[10px] font-bold font-numeric leading-none">
          {rate}%
        </span>
      </div>
    </div>
  );
}

// 列表卡右側：戰績圓環（小一點，不顯示中央百分比，旁邊註記勝負）
function ResultDonut({
  w, l, d, totalMatches,
}: {
  w: number; l: number; d: number; totalMatches: number;
}) {
  if (totalMatches === 0) {
    return (
      <div className="text-xs text-muted-foreground italic font-numeric whitespace-nowrap">
        未記錄
      </div>
    );
  }
  const decided = w + l + d;
  const rate = decided > 0 ? Math.round((w / decided) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <DonutCircle rate={rate} w={w} l={l} d={d} size={44} />
      <div className="flex flex-col gap-0.5 text-[11px] leading-none font-numeric">
        {w > 0 && <span className="text-success font-semibold">{w} 勝</span>}
        {l > 0 && <span className="text-destructive font-semibold">{l} 敗</span>}
        {d > 0 && <span className="text-muted-foreground">{d} 平</span>}
        {decided === 0 && <span className="text-muted-foreground italic">待結算</span>}
      </div>
    </div>
  );
}

// ── 篩選列 ─────────────────────────────────────────────────────────────
function FilterBar({
  availableYears,
  year, onYearChange,
  type, onTypeChange,
  search, onSearchChange,
  totalEvents, filteredEvents,
  hasActiveFilter, onClear,
}: {
  availableYears: number[];
  year: string; onYearChange: (v: string) => void;
  type: string; onTypeChange: (v: string) => void;
  search: string; onSearchChange: (v: string) => void;
  totalEvents: number; filteredEvents: number;
  hasActiveFilter: boolean; onClear: () => void;
}) {
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9"
            placeholder="搜尋對手、賽事名稱或地點"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center"
              aria-label="清除搜尋"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {availableYears.length > 0 && (
          <Select
            value={year}
            onChange={(e) => onYearChange(e.target.value)}
            className="h-9 w-auto min-w-[110px]"
          >
            <option value="all">全部學年</option>
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>{y} 學年</option>
            ))}
          </Select>
        )}

        <div className="inline-flex items-center rounded-full bg-muted/40 p-0.5 gap-0.5">
          <ToggleChip active={type === "all"} onClick={() => onTypeChange("all")}>全部</ToggleChip>
          <ToggleChip active={type === "Official"} onClick={() => onTypeChange("Official")} tone="info">比賽</ToggleChip>
          <ToggleChip active={type === "Friendly"} onClick={() => onTypeChange("Friendly")} tone="warning">友誼賽</ToggleChip>
        </div>

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-9">
            <X className="h-3.5 w-3.5 mr-1" /> 清除
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground font-numeric tabular-nums">
          {filteredEvents} / {totalEvents} 場
        </div>
      </div>
    </Card>
  );
}

const TOGGLE_TONE: Record<string, string> = {
  primary: "bg-primary text-primary-foreground shadow-soft",
  info: "bg-info text-info-foreground shadow-soft",
  warning: "bg-warning text-warning-foreground shadow-soft",
  success: "bg-success text-success-foreground shadow-soft",
  destructive: "bg-destructive text-destructive-foreground shadow-soft",
};

function ToggleChip({
  active, onClick, tone = "primary", children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: keyof typeof TOGGLE_TONE;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap",
        active
          ? TOGGLE_TONE[tone]
          : "text-muted-foreground hover:text-foreground hover:bg-background",
      )}
    >
      {children}
    </button>
  );
}

// ── 比分對決卡 ─────────────────────────────────────────────────────────
function MatchScoreCard({ item, isSplit }: { item: MatchLogItem; isSplit: boolean }) {
  const r = item.result as ResultKey | null;
  const sets = [
    [item.set1Our, item.set1Opp],
    [item.set2Our, item.set2Opp],
    [item.set3Our, item.set3Opp],
  ].filter(([a, b]) => a != null || b != null);

  // 分隊模式：邊框 / 背景依 A·B 著色；單隊模式則依勝負
  const containerCls = isSplit
    ? (item.ourSquad === "B"
        ? "border-info/40 bg-gradient-to-br from-info/[0.06] via-card to-card"
        : "border-primary/40 bg-gradient-to-br from-primary/[0.06] via-card to-card")
    : r === "W" ? "border-success/40 bg-gradient-to-br from-success/5 via-card to-card"
    : r === "L" ? "border-destructive/40 bg-gradient-to-br from-destructive/5 via-card to-card"
    : "border-border bg-card";

  const ourScoreCls =
    r === "W" ? "text-success"
    : r === "L" ? "text-foreground/60"
    : "text-foreground";

  const oppScoreCls =
    r === "L" ? "text-destructive"
    : r === "W" ? "text-foreground/60"
    : "text-foreground";

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all hover:shadow-lift hover:-translate-y-0.5",
        containerCls,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-numeric">vs</span>
        <div className="flex items-center gap-1">
          {isSplit && item.ourSquad && (
            <Chip tone={item.ourSquad === "B" ? "info" : "primary"} size="sm">
              {item.ourSquad}
            </Chip>
          )}
          {r && <Chip tone={RESULT_TONE[r]} size="sm">{RESULT_LABEL[r]}</Chip>}
        </div>
      </div>

      <div className="font-semibold text-sm truncate mb-2" title={item.opponent}>
        {item.opponent || "—"}
      </div>

      <div className="flex items-baseline justify-center gap-2 font-numeric mb-2">
        <span className={cn("text-3xl font-bold font-display tabular-nums leading-none", ourScoreCls)}>
          {item.ourScore ?? "-"}
        </span>
        <span className="text-lg text-muted-foreground">:</span>
        <span className={cn("text-3xl font-bold font-display tabular-nums leading-none", oppScoreCls)}>
          {item.opponentScore ?? "-"}
        </span>
      </div>

      {sets.length > 0 && (
        <div className={cn("grid gap-1 text-center text-[11px] font-numeric tabular-nums",
          sets.length === 1 && "grid-cols-1",
          sets.length === 2 && "grid-cols-2",
          sets.length === 3 && "grid-cols-3",
        )}>
          {sets.map(([a, b], i) => {
            const aN = a ?? null;
            const bN = b ?? null;
            const ourWon = aN != null && bN != null && aN > bN;
            const oppWon = aN != null && bN != null && bN > aN;
            return (
              <div
                key={i}
                className="rounded-md bg-muted/60 py-1 px-1 leading-tight"
              >
                <div className={cn("font-semibold", ourWon && "text-success")}>{aN ?? "-"}</div>
                <div className="text-[9px] text-muted-foreground/70">局{i + 1}</div>
                <div className={cn("font-semibold", oppWon && "text-destructive")}>{bN ?? "-"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 名單區 ────────────────────────────────────────────────────────────
function RosterSection({
  players, squadCount,
}: {
  players: MatchEventListItem["players"];
  squadCount: number;
}) {
  if (squadCount >= 2) {
    const a = players.filter((p) => p.ourSquad === "A");
    const b = players.filter((p) => p.ourSquad === "B");
    const unset = players.filter((p) => !p.ourSquad);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">出賽名單</h4>
          <Chip tone="outline" size="sm">{players.length}</Chip>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
          <SquadBlock title="A 隊" tone="primary" players={a} dense />
          <SquadBlock title="B 隊" tone="info" players={b} dense />
          {unset.length > 0 && (
            <SquadBlock title="未指定" tone="neutral" players={unset} className="xl:col-span-2" dense />
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">出賽名單</h4>
        <Chip tone="outline" size="sm">{players.length}</Chip>
      </div>
      <PositionGroupedChips players={players} />
    </div>
  );
}

const SQUAD_EDGE: Record<string, string> = {
  primary: "border-l-primary bg-primary/[0.04]",
  info: "border-l-info bg-info/[0.04]",
  neutral: "border-l-muted-foreground/40 bg-muted/30",
};

function SquadBlock({
  title, tone, players, className, dense,
}: {
  title: string;
  tone: "primary" | "info" | "neutral";
  players: MatchEventListItem["players"];
  className?: string;
  dense?: boolean;
}) {
  if (players.length === 0) return null;
  return (
    <div className={cn("rounded-lg border border-border/60 border-l-4 p-3 space-y-3", SQUAD_EDGE[tone], className)}>
      <div className="flex items-center gap-2">
        <Chip tone={tone} size="md">{title}</Chip>
        <span className="text-xs text-muted-foreground font-numeric tabular-nums">
          {players.length} 人
        </span>
      </div>
      <PositionGroupedChips players={players} dense={dense} />
    </div>
  );
}

function PositionGroupedChips({
  players,
  dense,
}: {
  players: MatchEventListItem["players"];
  dense?: boolean;
}) {
  const groups = useMemo(
    () => groupByPrimaryPosition(players, (p) => p.position),
    [players],
  );
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground">{g.label}</span>
            <span className="text-[10px] text-muted-foreground/70 font-numeric tabular-nums">
              {g.items.length}
            </span>
            <div className="flex-1 h-px bg-border/60" />
          </div>
          <div className={cn(
            "grid gap-2",
            dense
              ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
          )}>
            {g.items.map((p) => (
              <RosterChip key={p.playerId} player={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
