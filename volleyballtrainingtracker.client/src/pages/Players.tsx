import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Ruler,
  Hand,
  GraduationCap,
  Users,
  Search,
  X,
  ChevronDown,
  Download,
  Scale,
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  Trophy,
  CircleSlash,
  IdCard,
} from "lucide-react";
import {
  playersApi,
  PLAYER_STATUS,
  PLAYER_STATUS_LABEL,
  type Player,
  type PlayerStatus,
} from "@/api/players";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PERM, useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { exportCsv, datedFilename } from "@/lib/exportCsv";

// ── 位置代碼 / 顯示 / tone ──────────────────────────────────────────────
const POSITION_TONE: Record<string, "primary" | "info" | "navy" | "warning" | "success"> = {
  OH: "primary",
  OPP: "info",
  MB: "navy",
  S: "warning",
  L: "success",
};
const POSITION_OPTIONS = ["OH", "OPP", "MB", "S", "L"];
const POSITION_LABELS: Record<string, string> = {
  OH: "主攻",
  OPP: "副攻",
  MB: "攔中",
  S: "舉球員",
  L: "自由",
};
const positionsOf = (p: Player) =>
  p.position ? p.position.split(",").map((s) => s.trim()).filter(Boolean) : [];

// ── Sort 偏好 ───────────────────────────────────────────────────────────
type SortKey = "jersey" | "name" | "height" | "grade";
type SortDir = "asc" | "desc";
const SORT_LS = "vbtt-players-sort";
const SORT_DIR_LS = "vbtt-players-sort-dir";
const SORT_LABELS: Record<SortKey, string> = {
  jersey: "背號",
  name: "姓名",
  height: "身高",
  grade: "系級",
};

// ── 狀態選項從 enum 派生（移除 0/1/2 硬編碼）──
const STATUS_FILTER_OPTIONS = (Object.values(PLAYER_STATUS) as PlayerStatus[])
  .map((v) => ({ value: String(v), label: PLAYER_STATUS_LABEL[v] }))
  .sort((a, b) => Number(a.value) - Number(b.value)); // 確保順序穩定

const handLabel = (h: string | null | undefined) =>
  h === "Right" ? "右" : h === "Left" ? "左" : null;

// ════════════════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════════════════
export default function PlayersPage() {
  const canCreate = useAuthStore((s) => s.can(PERM.PlayersEdit));
  const canEdit = canCreate;
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => playersApi.list(),
  });

  // 即時搜尋／篩選（取消「查詢」按鈕，輸入即套用）
  const [query, setQuery] = useState("");
  const [filterPos, setFilterPos] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDup, setFilterDup] = useState(false);

  // Sort 偏好（localStorage 持久化）
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (localStorage.getItem(SORT_LS) as SortKey) || "jersey",
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    () => (localStorage.getItem(SORT_DIR_LS) as SortDir) || "asc",
  );
  useEffect(() => {
    localStorage.setItem(SORT_LS, sortKey);
  }, [sortKey]);
  useEffect(() => {
    localStorage.setItem(SORT_DIR_LS, sortDir);
  }, [sortDir]);

  // 摺疊（畢業/退隊預設摺疊，現役永遠展開）
  const [collapsed, setCollapsed] = useState<Record<PlayerStatus, boolean>>({
    [PLAYER_STATUS.Active]: false,
    [PLAYER_STATUS.Graduated]: true,
    [PLAYER_STATUS.Left]: true,
  });
  const toggleCollapse = (s: PlayerStatus) =>
    setCollapsed((c) => ({ ...c, [s]: !c[s] }));

  // 比較模式
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const toggleCompare = (id: number) =>
    setCompareIds((arr) => {
      if (arr.includes(id)) return arr.filter((x) => x !== id);
      if (arr.length >= 4) return arr;
      return [...arr, id];
    });

  // 重複號碼（現役）
  const dupNos = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of (data ?? []).filter((p) => p.isActive === PLAYER_STATUS.Active)) {
      if (p.jerseyNo != null)
        counts.set(p.jerseyNo, (counts.get(p.jerseyNo) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n),
    );
  }, [data]);

  const grades = useMemo(() => {
    const s = new Set(
      (data ?? []).map((p) => p.grade).filter((g): g is number => g != null),
    );
    return [...s].sort((a, b) => a - b);
  }, [data]);

  // 篩選
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.nickname ?? ""} ${p.jerseyNo ?? ""} ${p.studentId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterPos && !positionsOf(p).includes(filterPos)) return false;
      if (filterGrade && p.grade !== Number(filterGrade)) return false;
      if (filterStatus !== "" && String(p.isActive) !== filterStatus) return false;
      if (filterDup && (p.jerseyNo == null || !dupNos.has(p.jerseyNo))) return false;
      return true;
    });
  }, [data, query, filterPos, filterGrade, filterStatus, filterDup, dupNos]);

  // 排序（comparator 一律以「升冪」為準，再依 sortDir 反向）
  const sortFn = (a: Player, b: Player): number => {
    let cmp: number;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name, "zh-Hant");
        break;
      case "height":
        cmp = (a.heightCm ?? -Infinity) - (b.heightCm ?? -Infinity);
        break;
      case "grade":
        cmp = (a.grade ?? -Infinity) - (b.grade ?? -Infinity);
        break;
      case "jersey":
      default:
        cmp = (a.jerseyNo ?? Infinity) - (b.jerseyNo ?? Infinity);
    }
    return sortDir === "desc" ? -cmp : cmp;
  };

  const activeList = useMemo(
    () => filtered.filter((p) => p.isActive === PLAYER_STATUS.Active).sort(sortFn),
    [filtered, sortKey, sortDir], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const graduatedList = useMemo(
    () =>
      filtered.filter((p) => p.isActive === PLAYER_STATUS.Graduated).sort(sortFn),
    [filtered, sortKey, sortDir], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const leftList = useMemo(
    () => filtered.filter((p) => p.isActive === PLAYER_STATUS.Left).sort(sortFn),
    [filtered, sortKey, sortDir], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 球隊統計（取自全部資料，不受 filter 影響）
  const stats = useMemo(() => {
    const all = data ?? [];
    const active = all.filter((p) => p.isActive === PLAYER_STATUS.Active);
    const posCount: Record<string, number> = {};
    for (const p of active) {
      // 一個球員若有多個位置，只計入第一個（主位置）
      const primary = positionsOf(p)[0];
      if (primary) posCount[primary] = (posCount[primary] ?? 0) + 1;
    }
    return {
      activeCount: active.length,
      graduatedCount: all.filter((p) => p.isActive === PLAYER_STATUS.Graduated).length,
      leftCount: all.filter((p) => p.isActive === PLAYER_STATUS.Left).length,
      posCount,
    };
  }, [data]);

  const hasFilter =
    !!query || !!filterPos || !!filterGrade || filterStatus !== "" || filterDup;
  const clearAll = () => {
    setQuery("");
    setFilterPos("");
    setFilterGrade("");
    setFilterStatus("");
    setFilterDup(false);
  };

  // CSV 匯出（依目前篩選結果，按 現役/畢業/退隊 排序）
  const handleExport = () => {
    const ordered = [...activeList, ...graduatedList, ...leftList];
    exportCsv(datedFilename("players"), [
      ["背號", "學號", "姓名", "暱稱", "位置", "身高(cm)", "系級", "慣用手", "狀態"],
      ...ordered.map((p) => [
        p.jerseyNo ?? "",
        p.studentId ?? "",
        p.name,
        p.nickname ?? "",
        p.position ?? "",
        p.heightCm ?? "",
        p.grade ?? "",
        handLabel(p.dominantHand) ?? "",
        PLAYER_STATUS_LABEL[p.isActive],
      ]),
    ]);
  };

  const comparePlayers = useMemo(
    () => (data ?? []).filter((p) => compareIds.includes(p.id)),
    [data, compareIds],
  );

  // ── 鍵盤導航 ───────────────────────────────────────────────────────────
  const onCardKey = (
    e: React.KeyboardEvent<HTMLDivElement>,
    p: Player,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canEdit) navigate(`/players/${p.id}`);
    } else if (e.key === " ") {
      e.preventDefault();
      toggleCompare(p.id);
    } else if (
      e.key === "ArrowRight" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowUp"
    ) {
      e.preventDefault();
      const cur = e.currentTarget;
      const parent = cur.parentElement;
      if (!parent) return;
      const siblings = Array.from(
        parent.querySelectorAll<HTMLElement>("[data-pcard]"),
      );
      const idx = siblings.indexOf(cur);
      const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      siblings[idx + dir]?.focus();
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 pb-24">
      {/* 頁首 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">選手</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            球隊名單總覽 · 點擊卡片編輯，
            <kbd className="px-1 py-0.5 mx-0.5 text-[10px] bg-muted rounded">Space</kbd>
            加入比較
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
            <Download className="h-4 w-4 mr-1" />
            匯出
          </Button>
          {canCreate && (
            <Button onClick={() => navigate("/players/new")}>
              <Plus className="h-4 w-4 mr-1" />
              新增選手
            </Button>
          )}
        </div>
      </div>

      {/* Stat Strip */}
      <StatStrip stats={stats} />

      {/* Toolbar：搜尋 + 排序 + view */}
      <div className="rounded-lg border bg-card shadow-soft p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* 即時搜尋 */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋姓名 / 暱稱 / 背號 / 學號…"
              className="pl-8 pr-8 h-9"
              aria-label="搜尋選手"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
                aria-label="清除搜尋"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* 排序 */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowDownUp className="h-3.5 w-3.5" />
              排序
            </div>
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 w-24"
              aria-label="排序方式"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </Select>
            <button
              onClick={() =>
                setSortDir((d) => (d === "asc" ? "desc" : "asc"))
              }
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title={sortDir === "asc" ? "切換為倒序" : "切換為正序"}
              aria-label={sortDir === "asc" ? "目前正序，點擊切換倒序" : "目前倒序，點擊切換正序"}
            >
              {sortDir === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          <FilterPill
            icon="位置"
            value={filterPos}
            onChange={setFilterPos}
            options={POSITION_OPTIONS.map((p) => ({
              value: p,
              label: `${POSITION_LABELS[p]} (${p})`,
            }))}
          />
          <FilterPill
            icon="系級"
            value={filterGrade}
            onChange={setFilterGrade}
            options={grades.map((g) => ({ value: String(g), label: String(g) }))}
          />
          <FilterPill
            icon="狀態"
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_FILTER_OPTIONS}
          />
          <button
            onClick={() => setFilterDup((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-full border transition",
              filterDup
                ? "bg-warning/15 text-warning border-warning/40"
                : "bg-background border-border text-foreground/70 hover:bg-accent hover:text-accent-foreground hover:border-accent",
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            重複號碼
          </button>

          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs"
              onClick={clearAll}
            >
              <X className="h-3 w-3 mr-0.5" />
              全部清除
            </Button>
          )}
        </div>

        {/* Active filter chips（已套用條件顯示）*/}
        {hasFilter && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">已套用：</span>
            {query && (
              <ActiveChip label={`搜尋「${query}」`} onClear={() => setQuery("")} />
            )}
            {filterPos && (
              <ActiveChip
                label={`位置：${POSITION_LABELS[filterPos] ?? filterPos}`}
                onClear={() => setFilterPos("")}
              />
            )}
            {filterGrade && (
              <ActiveChip
                label={`系級：${filterGrade}`}
                onClear={() => setFilterGrade("")}
              />
            )}
            {filterStatus !== "" && (
              <ActiveChip
                label={`狀態：${
                  PLAYER_STATUS_LABEL[Number(filterStatus) as PlayerStatus]
                }`}
                onClear={() => setFilterStatus("")}
              />
            )}
            {filterDup && (
              <ActiveChip label="重複號碼" onClear={() => setFilterDup(false)} />
            )}
            <span className="ml-1 text-xs text-muted-foreground/70">
              · 共 {filtered.length} 人
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && <LoadingState />}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={Users}
          title={hasFilter ? "無符合條件的選手" : "尚無選手"}
          description={
            canCreate && !hasFilter
              ? "點擊右上「新增選手」開始建立名單"
              : undefined
          }
        />
      )}

      {/* Sections */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-6">
          <PlayerSection
            label="現役"
            status={PLAYER_STATUS.Active}
            list={activeList}
            dupNos={dupNos}
            collapsed={collapsed[PLAYER_STATUS.Active]}
            onToggle={() => toggleCollapse(PLAYER_STATUS.Active)}
            collapsible={false}
            accent="primary"
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
            canEdit={canEdit}
            onEdit={(id) => navigate(`/players/${id}`)}
            onCardKey={onCardKey}
          />
          {graduatedList.length > 0 && (
            <PlayerSection
              label="畢業"
              status={PLAYER_STATUS.Graduated}
              list={graduatedList}
              dupNos={dupNos}
              collapsed={collapsed[PLAYER_STATUS.Graduated]}
              onToggle={() => toggleCollapse(PLAYER_STATUS.Graduated)}
              collapsible
              accent="muted"
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              canEdit={canEdit}
              onEdit={(id) => navigate(`/players/${id}`)}
              onCardKey={onCardKey}
            />
          )}
          {leftList.length > 0 && (
            <PlayerSection
              label="退隊"
              status={PLAYER_STATUS.Left}
              list={leftList}
              dupNos={dupNos}
              collapsed={collapsed[PLAYER_STATUS.Left]}
              onToggle={() => toggleCollapse(PLAYER_STATUS.Left)}
              collapsible
              accent="destructive"
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              canEdit={canEdit}
              onEdit={(id) => navigate(`/players/${id}`)}
              onCardKey={onCardKey}
            />
          )}
        </div>
      )}

      {/* 比較浮動列 */}
      {compareIds.length > 0 && (
        <CompareBar
          players={comparePlayers}
          onRemove={(id) =>
            setCompareIds((arr) => arr.filter((x) => x !== id))
          }
          onClear={() => setCompareIds([])}
          onOpen={() => setCompareOpen(true)}
        />
      )}

      {compareOpen && (
        <CompareModal
          players={comparePlayers}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// StatStrip — 球隊總覽
// ════════════════════════════════════════════════════════════════════════
interface Stats {
  activeCount: number;
  graduatedCount: number;
  leftCount: number;
  posCount: Record<string, number>;
}
function StatStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <StatCard
        icon={UserCheck}
        label="現役"
        value={stats.activeCount}
        suffix="人"
        tone="primary"
      />
      <StatCard
        icon={Trophy}
        label="畢業 / 退隊"
        value={`${stats.graduatedCount} / ${stats.leftCount}`}
        tone="muted"
      />

      {/* 位置分布條（與兩個 StatCard 同列；mobile 換行）*/}
      <div className="rounded-lg border bg-card shadow-soft p-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          位置分布
        </span>
        {POSITION_OPTIONS.map((p) => {
          const n = stats.posCount[p] ?? 0;
          return (
            <Chip
              key={p}
              tone={n === 0 ? "neutral" : POSITION_TONE[p]}
              size="md"
              className={cn(n === 0 && "opacity-50")}
            >
              {POSITION_LABELS[p]}
              <span className="ml-0.5 font-numeric font-bold">{n}</span>
            </Chip>
          );
        })}
        {stats.activeCount === 0 && (
          <span className="text-xs text-muted-foreground italic">尚無現役球員</span>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  suffix?: string;
  tone: "primary" | "muted" | "info" | "navy";
}) {
  const toneCls = {
    primary: "text-primary bg-primary/10",
    muted: "text-muted-foreground bg-muted",
    info: "text-info bg-info/10",
    navy: "text-navy bg-navy/10",
  }[tone];
  return (
    <div className="rounded-lg border bg-card shadow-soft p-3 flex items-center gap-3">
      <div
        className={cn(
          "h-9 w-9 rounded-md inline-flex items-center justify-center shrink-0",
          toneCls,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-xl font-bold font-numeric leading-tight">
          {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          {suffix && (
            <span className="text-xs font-normal text-muted-foreground ml-0.5">
              {suffix}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Filter / View 控件
// ════════════════════════════════════════════════════════════════════════
function FilterPill({
  icon,
  value,
  onChange,
  options,
}: {
  icon: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "";
  // 顯式設定 option 背景/文字色，避免原生下拉在 dark 模式下白底白字看不清
  const optionStyle: React.CSSProperties = {
    backgroundColor: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
  };
  return (
    <div
      className={cn(
        "relative inline-flex items-center gap-1 h-7 pl-2.5 pr-1 text-xs rounded-full border transition",
        active
          ? "bg-primary/10 text-primary border-primary/40 hover:bg-primary/15"
          : "bg-background border-border text-foreground/70 hover:bg-accent hover:text-accent-foreground hover:border-accent",
      )}
    >
      <span>{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent pr-4 text-xs focus:outline-none cursor-pointer font-medium"
      >
        <option value="" style={optionStyle}>全部</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={optionStyle}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
    </div>
  );
}

function ActiveChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/30">
      {label}
      <button
        onClick={onClear}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-primary/20"
        aria-label={`清除 ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Section（含 header + 卡片內容）
// ════════════════════════════════════════════════════════════════════════
interface SectionProps {
  label: string;
  status: PlayerStatus;
  list: Player[];
  dupNos: Set<number>;
  collapsed: boolean;
  onToggle: () => void;
  collapsible: boolean;
  accent: "primary" | "muted" | "destructive";
  compareIds: number[];
  onToggleCompare: (id: number) => void;
  canEdit: boolean;
  onEdit: (id: number) => void;
  onCardKey: (e: React.KeyboardEvent<HTMLDivElement>, p: Player) => void;
}

function PlayerSection({
  label,
  list,
  dupNos,
  collapsed,
  onToggle,
  collapsible,
  accent,
  compareIds,
  onToggleCompare,
  canEdit,
  onEdit,
  onCardKey,
}: SectionProps) {
  if (list.length === 0) return null;

  const isActive = accent === "primary";

  return (
    <section>
      {/* Section header */}
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        className={cn(
          "w-full flex items-center gap-3 mb-3 text-left",
          collapsible && "cursor-pointer hover:opacity-80",
        )}
        aria-expanded={!collapsed}
      >
        {isActive ? (
          <span className="h-7 w-1 rounded-full bg-primary shrink-0" />
        ) : (
          <CircleSlash
            className={cn(
              "h-4 w-4 shrink-0",
              accent === "destructive"
                ? "text-destructive/70"
                : "text-muted-foreground/70",
            )}
          />
        )}
        <h2
          className={cn(
            "font-semibold tracking-tight",
            isActive
              ? "text-lg text-foreground"
              : "text-sm text-muted-foreground",
          )}
        >
          {label}
        </h2>
        <Chip
          tone={isActive ? "primary" : "neutral"}
          size="sm"
          className="font-numeric"
        >
          {list.length} 人
        </Chip>
        {collapsible && (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform ml-auto",
              !collapsed && "rotate-180",
            )}
          />
        )}
        {!collapsible && (
          <span className="ml-auto h-px flex-1 bg-border" aria-hidden />
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.035 } } }}
        >
          {list.map((p) => (
            <PlayerCard
              key={p.id}
              p={p}
              dupNos={dupNos}
              isInCompare={compareIds.includes(p.id)}
              onToggleCompare={onToggleCompare}
              canEdit={canEdit}
              onEdit={onEdit}
              onCardKey={onCardKey}
            />
          ))}
        </motion.div>
      )}
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PlayerCard — Phase 2 橫式重設計
// ════════════════════════════════════════════════════════════════════════
function PlayerCard({
  p,
  dupNos,
  isInCompare,
  onToggleCompare,
  canEdit,
  onEdit,
  onCardKey,
}: {
  p: Player;
  dupNos: Set<number>;
  isInCompare: boolean;
  onToggleCompare: (id: number) => void;
  canEdit: boolean;
  onEdit: (id: number) => void;
  onCardKey: (e: React.KeyboardEvent<HTMLDivElement>, p: Player) => void;
}) {
  const isActive = p.isActive === PLAYER_STATUS.Active;
  const isLeft = p.isActive === PLAYER_STATUS.Left;
  const positions = positionsOf(p);
  const primaryPos = positions[0];
  const dupJersey = isActive && p.jerseyNo != null && dupNos.has(p.jerseyNo);
  const hand = handLabel(p.dominantHand);
  const hasStats = p.heightCm != null || p.grade != null || hand != null || !!p.studentId;

  return (
    <motion.div
      data-pcard
      tabIndex={0}
      role="button"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
      aria-label={`${p.name}${p.nickname ? ` ${p.nickname}` : ""}，背號 ${
        p.jerseyNo ?? "未指定"
      }`}
      onClick={() => canEdit && onEdit(p.id)}
      onKeyDown={(e) => onCardKey(e, p)}
      className={cn(
        "group relative cursor-pointer rounded-xl border bg-card flex overflow-hidden transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isInCompare
          ? "ring-2 ring-primary border-primary shadow-lift -translate-y-0.5"
          : "border-border shadow-soft hover:shadow-lift hover:-translate-y-0.5",
        !isActive && "opacity-90",
      )}
    >
      {/* 左：背號色帶 */}
      <div
        className={cn(
          "relative w-20 shrink-0 flex flex-col items-center justify-center text-white px-1.5",
          isActive
            ? "bg-gradient-to-b from-primary to-primary/70"
            : isLeft
              ? "bg-gradient-to-b from-destructive/70 to-destructive/50"
              : "bg-gradient-to-b from-muted-foreground/60 to-muted-foreground/40",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-[70px] font-black leading-none text-white/[0.08]"
        >
          {p.jerseyNo ?? "?"}
        </span>
        <span className="font-numeric text-3xl font-black leading-none drop-shadow-sm relative">
          {p.jerseyNo ?? "—"}
        </span>
        {primaryPos && (
          <span className="mt-1 text-[10px] font-bold tracking-wider opacity-95 relative">
            {primaryPos}
          </span>
        )}
        {dupJersey && (
          <span
            className="absolute top-1 left-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-warning text-warning-foreground"
            title="背號重複"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* 右：內容 */}
      <div className="flex-1 px-3 py-2.5 flex flex-col justify-center gap-1.5 min-w-0">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <p className="font-bold text-base leading-tight truncate">{p.name}</p>
          {p.nickname && (
            <p className="text-xs text-muted-foreground truncate">
              {p.nickname}
            </p>
          )}
        </div>

        {positions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {positions.map((c) => (
              <Chip
                key={c}
                tone={POSITION_TONE[c] ?? "neutral"}
                size="sm"
              >
                {POSITION_LABELS[c] ?? c}
              </Chip>
            ))}
          </div>
        )}

        {hasStats && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
            {p.studentId && (
              <span
                className="inline-flex items-center gap-0.5 font-numeric"
                title={`學號 ${p.studentId}`}
              >
                <IdCard className="h-3 w-3" />
                {p.studentId}
              </span>
            )}
            {p.heightCm != null && (
              <span className="inline-flex items-center gap-0.5 font-numeric">
                <Ruler className="h-3 w-3" />
                {p.heightCm}
                <span className="text-[9px]">cm</span>
              </span>
            )}
            {p.grade != null && (
              <span className="inline-flex items-center gap-0.5 font-numeric">
                <GraduationCap className="h-3 w-3" />
                {p.grade}
              </span>
            )}
            {hand && (
              <span className="inline-flex items-center gap-0.5">
                <Hand className="h-3 w-3" />
                {hand}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 操作按鈕：比較常駐顯示（行動裝置可點），編輯於 hover 時顯示 */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        <CardIconButton
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompare(p.id);
          }}
          title={isInCompare ? "從比較移除" : "加入比較"}
          active={isInCompare}
          className="h-8 w-8"
        >
          <Scale className="h-4 w-4" />
        </CardIconButton>
        {canEdit && (
          <CardIconButton
            onClick={(e) => {
              e.stopPropagation();
              onEdit(p.id);
            }}
            title="編輯"
            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </CardIconButton>
        )}
      </div>

      {/* 比較選中標記 */}
      {isInCompare && (
        <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
          ✓
        </span>
      )}

      {/* 狀態微標（畢業/退隊）*/}
      {!isActive && (
        <span className="absolute bottom-1.5 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm border text-muted-foreground">
          {PLAYER_STATUS_LABEL[p.isActive]}
        </span>
      )}
    </motion.div>
  );
}

function CardIconButton({
  onClick,
  title,
  active,
  className,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex items-center justify-center h-6 w-6 rounded-md backdrop-blur-sm transition",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-background/90 text-muted-foreground border border-border hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Compare（浮動列 + Modal）
// ════════════════════════════════════════════════════════════════════════
function CompareBar({
  players,
  onRemove,
  onClear,
  onOpen,
}: {
  players: Player[];
  onRemove: (id: number) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] lg:bottom-6 z-40 max-w-[calc(100vw-1rem)] w-auto animate-slide-up">
      <div className="rounded-xl border bg-card shadow-lift px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Scale className="h-3.5 w-3.5" />
          已選 {players.length}/4
        </div>
        <div className="flex items-center gap-1 overflow-x-auto max-w-md">
          {players.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 h-7 pl-2 pr-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/30 whitespace-nowrap"
            >
              <span className="font-numeric font-bold">
                {p.jerseyNo ?? "—"}
              </span>
              <span className="truncate max-w-[5rem]">{p.name}</span>
              <button
                onClick={() => onRemove(p.id)}
                className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-primary/20"
                aria-label={`移除 ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <Button
            size="sm"
            disabled={players.length < 2}
            onClick={onOpen}
            title={players.length < 2 ? "至少選 2 位" : "開始比較"}
          >
            比較
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            清除
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompareModal({
  players,
  onClose,
}: {
  players: Player[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: { label: string; render: (p: Player) => React.ReactNode }[] = [
    {
      label: "背號",
      render: (p) => (
        <span className="font-numeric font-bold text-lg">
          {p.jerseyNo ?? "—"}
        </span>
      ),
    },
    {
      label: "姓名",
      render: (p) => (
        <div>
          <p className="font-semibold">{p.name}</p>
          {p.nickname && (
            <p className="text-xs text-muted-foreground">{p.nickname}</p>
          )}
        </div>
      ),
    },
    {
      label: "學號",
      render: (p) =>
        p.studentId ? (
          <span className="font-numeric">{p.studentId}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      label: "位置",
      render: (p) => {
        const positions = positionsOf(p);
        return positions.length === 0 ? (
          <span className="text-muted-foreground/50">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {positions.map((c) => (
              <Chip key={c} tone={POSITION_TONE[c] ?? "neutral"} size="sm">
                {POSITION_LABELS[c] ?? c}
              </Chip>
            ))}
          </div>
        );
      },
    },
    {
      label: "身高",
      render: (p) => (
        <span className="font-numeric">
          {p.heightCm != null ? `${p.heightCm} cm` : "—"}
        </span>
      ),
    },
    {
      label: "系級",
      render: (p) => (
        <span className="font-numeric">{p.grade ?? "—"}</span>
      ),
    },
    {
      label: "慣用手",
      render: (p) => <span>{handLabel(p.dominantHand) ?? "—"}</span>,
    },
    {
      label: "狀態",
      render: (p) => (
        <span className="text-xs">{PLAYER_STATUS_LABEL[p.isActive]}</span>
      ),
    },
  ];

  // 找出每列「最大值」做視覺強調
  const highlights: Record<string, number | null> = {
    身高: Math.max(
      ...players.map((p) => p.heightCm ?? -Infinity),
    ),
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-lift w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 flex items-center justify-between border-b">
          <h3 className="text-lg font-semibold">
            比較 {players.length} 位球員
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto p-3 sm:p-5">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-muted-foreground font-medium pb-2 w-20">
                  項目
                </th>
                {players.map((p) => (
                  <th
                    key={p.id}
                    className="text-left font-medium pb-2 px-3 min-w-[8rem]"
                  >
                    <span className="text-xs text-muted-foreground">
                      #{p.jerseyNo ?? "—"}
                    </span>
                    <p className="font-semibold">{p.name}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border/60">
                  <td className="py-2.5 text-xs text-muted-foreground align-top">
                    {row.label}
                  </td>
                  {players.map((p) => {
                    const isMax =
                      row.label === "身高" &&
                      p.heightCm != null &&
                      p.heightCm === highlights.身高;
                    return (
                      <td
                        key={p.id}
                        className={cn(
                          "py-2.5 px-3 align-top",
                          isMax &&
                            "bg-primary/5 text-primary font-bold",
                        )}
                      >
                        {row.render(p)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {players.length < 2 && (
            <p className="mt-3 text-xs text-muted-foreground italic text-center">
              至少選擇 2 位球員才能進行比較
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Loading
// ════════════════════════════════════════════════════════════════════════
function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card shadow-soft flex overflow-hidden h-[88px]"
        >
          <Skeleton className="w-20 h-full rounded-none" />
          <div className="flex-1 px-3 py-2.5 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
