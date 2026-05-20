import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2, Plus, Minus, Swords, Users, Info, Save,
  CalendarDays, ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SelectableRosterChip } from "@/components/RosterChip";
import { groupByPrimaryPosition } from "@/lib/positions";
import {
  matchEventsApi,
  type MatchEventDetail,
  type MatchEventUpsert,
  type MatchLogItem,
  type MatchLogUpsert,
  type MatchLogSetInput,
} from "@/api/matchLogs";
import { playersApi, type Player } from "@/api/players";
import { PERM, useAuthStore } from "@/stores/authStore";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { DateInput } from "@/components/DateInput";
import { cn } from "@/lib/utils";

// ── 常數 ──────────────────────────────────────────────────────────────
const MATCH_SCORES = ["2:0", "2:1", "1:2", "0:2"] as const;

const RESULTS = [
  { value: "W", label: "勝", tone: "success" as const },
  { value: "L", label: "敗", tone: "destructive" as const },
  { value: "D", label: "平", tone: "neutral" as const },
];

const RESULT_ACTIVE_CLS: Record<string, string> = {
  W: "bg-success text-success-foreground border-success shadow-soft",
  L: "bg-destructive text-destructive-foreground border-destructive shadow-soft",
  D: "bg-muted-foreground text-background border-muted-foreground shadow-soft",
};

const MATCH_TYPES = [
  { value: "Official", label: "比賽" },
  { value: "Friendly", label: "友誼賽" },
] as const;

const SQUAD_OPTIONS = ["A", "B"] as const;
const SQUAD_LABEL: Record<string, string> = { A: "A 隊", B: "B 隊" };

function parseMatchScore(s: string): [number | null, number | null] {
  if (!s) return [null, null];
  const [a, b] = s.split(":").map(Number);
  return [a ?? null, b ?? null];
}

function toInt(s: string): number | null {
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function intStr(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

// ── 類型 ──────────────────────────────────────────────────────────────
interface FriendlySet {
  ourScore: string;
  oppScore: string;
}

interface GameRow {
  id?: number;
  opponent: string;
  ourSquad: string;
  set1Our: string;
  set1Opp: string;
  set2Our: string;
  set2Opp: string;
  set3Our: string;
  set3Opp: string;
  matchScore: string;
  result: string;
  matchDate: string;
  sets: FriendlySet[];
  /** Friendly：sets 為空時可手動輸入「局數 W:L」 */
  manualWins: string;
  manualLosses: string;
}

function emptySet(): FriendlySet {
  return { ourScore: "", oppScore: "" };
}

function emptyRow(): GameRow {
  return {
    opponent: "",
    ourSquad: "",
    set1Our: "", set1Opp: "",
    set2Our: "", set2Opp: "",
    set3Our: "", set3Opp: "",
    matchScore: "",
    result: "",
    matchDate: "",
    sets: [],
    manualWins: "",
    manualLosses: "",
  };
}

function itemToRow(m: MatchLogItem): GameRow {
  const ms =
    m.ourScore != null && m.opponentScore != null
      ? `${m.ourScore}:${m.opponentScore}`
      : "";
  // 若該對戰已有 sets 子表，UI 將以 sets tally 為準，manual 欄位留空；
  // 沒有 sets 但有 ourScore/opponentScore，視為「手動局數」模式回填
  const hasSets = m.sets.length > 0;
  return {
    id: m.id,
    opponent: m.opponent,
    ourSquad: m.ourSquad ?? "",
    set1Our: intStr(m.set1Our), set1Opp: intStr(m.set1Opp),
    set2Our: intStr(m.set2Our), set2Opp: intStr(m.set2Opp),
    set3Our: intStr(m.set3Our), set3Opp: intStr(m.set3Opp),
    matchScore: ms,
    result: m.result ?? "",
    matchDate: m.matchDate ? m.matchDate.slice(0, 10) : "",
    sets: m.sets.map((s) => ({ ourScore: intStr(s.ourScore), oppScore: intStr(s.opponentScore) })),
    manualWins: hasSets ? "" : intStr(m.ourScore),
    manualLosses: hasSets ? "" : intStr(m.opponentScore),
  };
}

/** 由 sets 計算「贏的局數 / 輸的局數」（有平分的局不計） */
function tallySets(sets: FriendlySet[]): { wins: number; losses: number } {
  let wins = 0, losses = 0;
  for (const s of sets) {
    const a = toInt(s.ourScore);
    const b = toInt(s.oppScore);
    if (a == null || b == null) continue;
    if (a > b) wins++;
    else if (b > a) losses++;
  }
  return { wins, losses };
}

// ── 局分輸入（含 +/- stepper）────────────────────────────────────────
function SetScoreInput({
  value, onChange, placeholder, accent,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accent?: "our" | "opp";
}) {
  const n = toInt(value);
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(99, (n ?? 0) + delta));
    onChange(String(next));
  };
  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => step(-1)}
        className="h-8 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
        disabled={n == null || n <= 0}
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        min={0}
        max={99}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-10 h-8 text-center text-sm font-numeric tabular-nums border-x border-input bg-background focus:outline-none focus:ring-0",
          accent === "our" && "text-primary font-semibold",
          accent === "opp" && "text-foreground",
        )}
      />
      <button
        type="button"
        onClick={() => step(1)}
        className="h-8 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── 對戰卡片（取代原表格列）────────────────────────────────────────
function MatchRowCard({
  idx, row, splitMode, canRemove, showDate, eventStartDate, friendlyMode,
  onChange, onRemove,
}: {
  idx: number;
  row: GameRow;
  splitMode: boolean;
  canRemove: boolean;
  showDate: boolean;
  eventStartDate: string;
  friendlyMode: boolean;
  onChange: (patch: Partial<GameRow>) => void;
  onRemove: () => void;
}) {
  // Friendly：動態局列管理
  const updateSet = (i: number, patch: Partial<FriendlySet>) => {
    const next = row.sets.map((s, idx2) => (idx2 === i ? { ...s, ...patch } : s));
    onChange({ sets: next });
  };
  const addSet = () => onChange({ sets: [...row.sets, emptySet()] });
  const removeSet = (i: number) => onChange({ sets: row.sets.filter((_, idx2) => idx2 !== i) });
  const friendlyTally = friendlyMode ? tallySets(row.sets) : null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3 shadow-soft hover:shadow-lift transition-shadow">
      {/* 標頭：我方 / 對手 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold font-numeric">
            #{idx + 1}
          </span>
          {splitMode && (
            <Select
              value={row.ourSquad}
              onChange={(e) => onChange({ ourSquad: e.target.value })}
              className="h-8 w-auto min-w-[68px] px-2"
            >
              {SQUAD_OPTIONS.map((s) => (
                <option key={s} value={s}>{SQUAD_LABEL[s]}</option>
              ))}
            </Select>
          )}
        </div>
        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          value={row.opponent}
          onChange={(e) => onChange({ opponent: e.target.value })}
          placeholder="對手隊名 *"
          className="flex-1 min-w-[120px] h-8"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="移除此對戰"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 局分區：Official 固定 3 局；Friendly 動態 N 局 */}
      {friendlyMode ? (
        <div className="rounded-lg bg-muted/30 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-numeric">
              局分（友誼賽動態）
            </span>
            {/* 局數 W:L：sets 為空時可手動輸入；有 sets 時改顯示自動計算結果且唯讀 */}
            {row.sets.length > 0 && friendlyTally ? (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-numeric tabular-nums text-muted-foreground"
                title="由各局自動計算"
              >
                <span>局數</span>
                <span className="text-success font-semibold">{friendlyTally.wins}</span>
                <span>:</span>
                <span className="text-destructive font-semibold">{friendlyTally.losses}</span>
                <span className="text-muted-foreground/60 text-[10px] ml-0.5">（自動）</span>
              </span>
            ) : (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-muted-foreground">局數</span>
                <input
                  type="number" min={0} max={99}
                  value={row.manualWins}
                  onChange={(e) => onChange({ manualWins: e.target.value })}
                  placeholder="0"
                  className="w-10 h-7 text-center text-xs font-numeric tabular-nums rounded-md border border-input bg-background text-success font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label="我方局勝數"
                />
                <span className="text-muted-foreground">:</span>
                <input
                  type="number" min={0} max={99}
                  value={row.manualLosses}
                  onChange={(e) => onChange({ manualLosses: e.target.value })}
                  placeholder="0"
                  className="w-10 h-7 text-center text-xs font-numeric tabular-nums rounded-md border border-input bg-background text-destructive font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label="對方局勝數"
                />
              </div>
            )}
          </div>
          {row.sets.length === 0 && (
            <p className="text-[10px] text-muted-foreground/70">
              不想記每局？直接填上方局數即可；想記細節則點下方新增。
            </p>
          )}
          {row.sets.length > 0 && (
            <div className="space-y-1.5">
              {row.sets.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-numeric w-8 shrink-0">局{i + 1}</span>
                  <SetScoreInput
                    value={s.ourScore}
                    onChange={(v) => updateSet(i, { ourScore: v })}
                    placeholder="我"
                    accent="our"
                  />
                  <span className="text-muted-foreground text-xs">:</span>
                  <SetScoreInput
                    value={s.oppScore}
                    onChange={(v) => updateSet(i, { oppScore: v })}
                    placeholder="對"
                    accent="opp"
                  />
                  <button
                    type="button"
                    onClick={() => removeSet(i)}
                    className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="移除此局"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSet}
            className="w-full h-7 text-[11px]"
          >
            <Plus className="h-3 w-3 mr-1" /> 新增一局
          </Button>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/30 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-numeric">局分</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">或直接選大比分</span>
              <Select
                value={row.matchScore}
                onChange={(e) => onChange({ matchScore: e.target.value })}
                className="h-7 w-auto pl-2 pr-7 py-0 text-xs font-numeric min-w-[64px]"
                aria-label="大比分"
              >
                <option value="">-</option>
                {MATCH_SCORES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((n) => {
              const ourKey = `set${n}Our` as keyof GameRow;
              const oppKey = `set${n}Opp` as keyof GameRow;
              return (
                <div key={n} className="space-y-1">
                  <div className="text-center text-[10px] text-muted-foreground font-numeric">
                    局 {n}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <SetScoreInput
                      value={row[ourKey] as string}
                      onChange={(v) => onChange({ [ourKey]: v } as Partial<GameRow>)}
                      placeholder="我"
                      accent="our"
                    />
                    <SetScoreInput
                      value={row[oppKey] as string}
                      onChange={(v) => onChange({ [oppKey]: v } as Partial<GameRow>)}
                      placeholder="對"
                      accent="opp"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 對戰日期（僅 Official 顯示） */}
      {showDate && (
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">對戰日</span>
          <input
            type="date"
            value={row.matchDate}
            onChange={(e) => onChange({ matchDate: e.target.value })}
            className="h-7 px-1.5 rounded-md border border-input bg-background text-xs font-numeric tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {row.matchDate ? (
            <button
              type="button"
              onClick={() => onChange({ matchDate: "" })}
              className="text-muted-foreground hover:text-foreground underline"
            >
              清除
            </button>
          ) : (
            eventStartDate && (
              <span className="text-muted-foreground/70 font-numeric tabular-nums">
                同起始日 {eventStartDate.slice(5, 7)}/{eventStartDate.slice(8, 10)}
              </span>
            )
          )}
        </div>
      )}

      {/* 結果（Official 比分 Select 已上移；Friendly 局數 chip 在局分區內顯示） */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 ml-auto">
          {RESULTS.map((r) => {
            const active = row.result === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() =>
                  onChange({ result: row.result === r.value ? "" : r.value })
                }
                className={cn(
                  "px-2.5 py-1 rounded-md border text-xs font-semibold transition-all",
                  active
                    ? RESULT_ACTIVE_CLS[r.value]
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 球員多選（單欄 / 雙欄 A·B）────────────────────────────────────────
function RosterPicker({
  selected, onToggle, splitMode, onSquadChange,
}: {
  selected: Map<number, string | null>;
  onToggle: (id: number) => void;
  splitMode: boolean;
  onSquadChange: (id: number, squad: string | null) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["players", "active"],
    queryFn: () => playersApi.list(true),
  });
  const sortedPlayers = useMemo(
    () =>
      (data ?? []).slice().sort((a, b) => {
        const ja = a.jerseyNo ?? Number.MAX_SAFE_INTEGER;
        const jb = b.jerseyNo ?? Number.MAX_SAFE_INTEGER;
        if (ja !== jb) return ja - jb;
        return a.name.localeCompare(b.name);
      }),
    [data],
  );

  if (isLoading) return <div className="text-sm text-muted-foreground">載入球員清單…</div>;
  if (sortedPlayers.length === 0) {
    return <div className="text-sm text-muted-foreground">尚無啟用中的球員</div>;
  }

  if (!splitMode) {
    return (
      <PositionGroupedPicker
        players={sortedPlayers}
        selected={selected}
        onToggle={onToggle}
        splitMode={false}
        onSquadChange={onSquadChange}
      />
    );
  }

  // 分隊模式：左右雙欄 (A / B)
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <SquadColumn
        title="A 隊" tone="primary"
        players={sortedPlayers}
        selected={selected}
        targetSquad="A"
        onToggle={onToggle}
        onSquadChange={onSquadChange}
      />
      <SquadColumn
        title="B 隊" tone="info"
        players={sortedPlayers}
        selected={selected}
        targetSquad="B"
        onToggle={onToggle}
        onSquadChange={onSquadChange}
      />
    </div>
  );
}

function SquadColumn({
  title, tone, players, selected, targetSquad,
  onToggle, onSquadChange,
}: {
  title: string;
  tone: "primary" | "info";
  players: Player[];
  selected: Map<number, string | null>;
  targetSquad: "A" | "B";
  onToggle: (id: number) => void;
  onSquadChange: (id: number, s: string | null) => void;
}) {
  // 顯示：屬於此隊 OR 尚未在名單中的球員。已被選到對方隊則不在此欄顯示。
  const visible = players.filter((p) => {
    if (!selected.has(p.id)) return true;
    return selected.get(p.id) === targetSquad;
  });
  const myCount = Array.from(selected.values()).filter((v) => v === targetSquad).length;
  const edgeCls = tone === "primary" ? "border-l-primary bg-primary/[0.04]" : "border-l-info bg-info/[0.04]";

  return (
    <div className={cn("rounded-xl border border-l-4 border-border/60 p-3 space-y-3", edgeCls)}>
      <div className="flex items-center gap-2">
        <Chip tone={tone} size="md">{title}</Chip>
        <span className="text-xs text-muted-foreground font-numeric tabular-nums">
          已選 {myCount} 人
        </span>
      </div>
      <PositionGroupedPicker
        players={visible}
        selected={selected}
        onToggle={(id) => {
          if (!selected.has(id)) {
            // 點未在名單者 → 直接加入此隊
            onToggle(id);
            onSquadChange(id, targetSquad);
          } else {
            // 點已在名單者 → 移除
            onToggle(id);
          }
        }}
        splitMode={true}
        onSquadChange={onSquadChange}
        targetSquad={targetSquad}
      />
    </div>
  );
}

function PositionGroupedPicker({
  players, selected, onToggle, splitMode, onSquadChange, targetSquad,
}: {
  players: Player[];
  selected: Map<number, string | null>;
  onToggle: (id: number) => void;
  splitMode: boolean;
  onSquadChange: (id: number, squad: string | null) => void;
  targetSquad?: "A" | "B";
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {g.items.map((p) => {
              const inSquad = selected.has(p.id);
              // 在 SquadColumn 內：只當該球員選到「此欄的 squad」時才視為 selected
              const isSelected = targetSquad
                ? selected.get(p.id) === targetSquad
                : inSquad;
              return (
                <SelectableRosterChip
                  key={p.id}
                  player={p}
                  selected={isSelected}
                  onClick={() => onToggle(p.id)}
                  showSquadPicker={splitMode && !targetSquad}
                  squad={selected.get(p.id) ?? null}
                  onSquadChange={(s) => onSquadChange(p.id, s)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 主表單 ─────────────────────────────────────────────────────────────
function MatchEventForm({
  mode, initial,
}: {
  mode: "create" | "edit";
  initial?: MatchEventDetail;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.can(PERM.MatchLogsEdit));
  const canDelete = canEdit;

  const [matchDate, setMatchDate] = useState(() => initial?.matchDate.slice(0, 10) ?? "");
  const [matchType, setMatchType] = useState(() => initial?.matchType ?? "");
  const [academicYear, setAcademicYear] = useState(() =>
    initial?.academicYear != null ? String(initial.academicYear) : "",
  );
  const [matchName, setMatchName] = useState(() => initial?.matchName ?? "");
  const [location, setLocation] = useState(() => initial?.location ?? "");
  const [videoUrl, setVideoUrl] = useState(() => initial?.videoUrl ?? "");
  const [ranking, setRanking] = useState(() => initial?.ranking ?? "");
  const [rankingB, setRankingB] = useState(() => initial?.rankingB ?? "");
  const [notes, setNotes] = useState(() => initial?.notes ?? "");
  const [rows, setRows] = useState<GameRow[]>(() =>
    initial && initial.matches.length > 0 ? initial.matches.map(itemToRow) : [emptyRow()],
  );
  const [squadCount, setSquadCount] = useState<number>(() => initial?.squadCount ?? 1);
  const [selectedPlayers, setSelectedPlayers] = useState<Map<number, string | null>>(
    () => new Map(initial?.players.map((p) => [p.playerId, p.ourSquad ?? null]) ?? []),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const splitMode = squadCount >= 2;

  const updateRow = (idx: number, patch: Partial<GameRow>) => {
    setRows((prev) => {
      const next = [...prev];
      const updated = { ...next[idx], ...patch };
      if (patch.matchScore !== undefined) {
        if (patch.matchScore === "2:0" || patch.matchScore === "2:1") updated.result = "W";
        else if (patch.matchScore === "0:2" || patch.matchScore === "1:2") updated.result = "L";
      }
      next[idx] = updated;
      return next;
    });
  };

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        ...emptyRow(),
        ourSquad: splitMode ? "A" : "",
      },
    ]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const togglePlayer = (id: number) =>
    setSelectedPlayers((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, splitMode ? "A" : null);
      return next;
    });

  const setPlayerSquad = (id: number, squad: string | null) =>
    setSelectedPlayers((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, squad);
      return next;
    });

  const changeSquadCount = async (next: number) => {
    if (next === squadCount) return;
    if (next < 2 && splitMode) {
      const hasSquadOnPlayer = Array.from(selectedPlayers.values()).some((s) => s);
      const hasSquadOnRow = rows.some((r) => r.ourSquad);
      if (hasSquadOnPlayer || hasSquadOnRow) {
        const result = await confirmAction(
          "切回單隊？",
          "將清除所有球員與對戰列的 A/B 分配，並清除 B 隊名次。",
          "確定",
          true,
        );
        if (!result.isConfirmed) return;
      }
      setSelectedPlayers((prev) => new Map(Array.from(prev.keys()).map((k) => [k, null])));
      setRows((prev) => prev.map((r) => ({ ...r, ourSquad: "" })));
      setRankingB("");
    } else if (next >= 2 && !splitMode) {
      setSelectedPlayers((prev) =>
        new Map(Array.from(prev.entries()).map(([k, v]) => [k, v ?? "A"])),
      );
      setRows((prev) => prev.map((r) => ({ ...r, ourSquad: r.ourSquad || "A" })));
    }
    setSquadCount(next);
  };

  const buildMatchPayload = (row: GameRow): MatchLogUpsert => {
    const squad = row.ourSquad.trim();
    // 對戰日期僅在 Official 時才送出；其餘種類後端也會強制清空，雙重保險
    const md = matchType === "Official" && row.matchDate ? `${row.matchDate}T00:00:00` : null;
    const baseSquad = splitMode ? (squad || "A") : null;

    if (matchType === "Friendly") {
      // Friendly：用 sets 子表；OurScore/OpponentScore = 局勝數
      const sets: MatchLogSetInput[] = row.sets
        .map((s, i) => {
          const a = toInt(s.ourScore);
          const b = toInt(s.oppScore);
          if (a == null || b == null) return null;
          return { setIndex: i + 1, ourScore: a, opponentScore: b };
        })
        .filter((s): s is MatchLogSetInput => s !== null);
      // sets 有資料 → 用 tally；sets 空白 → 用 manualWins/Losses
      let wins: number | null;
      let losses: number | null;
      if (row.sets.length > 0) {
        const t = tallySets(row.sets);
        wins = t.wins;
        losses = t.losses;
      } else {
        wins = toInt(row.manualWins);
        losses = toInt(row.manualLosses);
      }
      const autoResult =
        wins != null && losses != null
          ? (wins > losses ? "W" : losses > wins ? "L" : wins > 0 ? "D" : null)
          : null;
      return {
        id: row.id,
        opponent: row.opponent.trim(),
        ourSquad: baseSquad,
        set1Our: null, set1Opp: null,
        set2Our: null, set2Opp: null,
        set3Our: null, set3Opp: null,
        ourScore: wins, opponentScore: losses,
        result: row.result || autoResult,
        matchDate: null,
        sets,
      };
    }

    // Official / 未指定種類：沿用 Set1/2/3 + matchScore
    const [ourScore, opponentScore] = parseMatchScore(row.matchScore);
    return {
      id: row.id,
      opponent: row.opponent.trim(),
      ourSquad: baseSquad,
      set1Our: toInt(row.set1Our), set1Opp: toInt(row.set1Opp),
      set2Our: toInt(row.set2Our), set2Opp: toInt(row.set2Opp),
      set3Our: toInt(row.set3Our), set3Opp: toInt(row.set3Opp),
      ourScore, opponentScore,
      result: row.result || null,
      matchDate: md,
      sets: [],
    };
  };

  const buildPayload = (validRows: GameRow[]): MatchEventUpsert => ({
    matchDate: `${matchDate}T00:00:00`,
    matchType: matchType || null,
    academicYear: toInt(academicYear),
    matchName: matchName.trim() || null,
    location: location.trim() || null,
    videoUrl: videoUrl.trim() || null,
    ranking: ranking.trim() || null,
    rankingB: splitMode ? (rankingB.trim() || null) : null,
    notes: notes.trim() || null,
    squadCount,
    players: Array.from(selectedPlayers.entries()).map(([playerId, ourSquad]) => ({
      playerId,
      ourSquad: splitMode ? (ourSquad ?? "A") : null,
    })),
    matches: validRows.map(buildMatchPayload),
  });

  const onSubmit = async () => {
    if (!matchDate) { showError("請填寫賽事起始日"); return; }
    const validRows = rows.filter((r) => r.opponent.trim());
    setIsSubmitting(true);
    try {
      const payload = buildPayload(validRows);
      if (mode === "edit" && initial) {
        await matchEventsApi.update(initial.id, payload);
      } else {
        await matchEventsApi.create(payload);
      }
      await qc.invalidateQueries({ queryKey: ["match-events"] });
      await showSuccess("儲存成功");
      navigate("/match-logs");
    } catch {
      showError("儲存失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDeleteAll = async () => {
    if (mode !== "edit" || !initial) return;
    const result = await confirmAction(
      "確定刪除整場比賽？",
      `將刪除 ${initial.matches.length} 筆對戰紀錄，此操作無法復原。`,
      "刪除",
      true,
    );
    if (!result.isConfirmed) return;
    setIsSubmitting(true);
    try {
      await matchEventsApi.remove(initial.id);
      await qc.invalidateQueries({ queryKey: ["match-events"] });
      await showSuccess("已刪除比賽");
      navigate("/match-logs");
    } catch {
      showError("刪除失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const squadCounts = useMemo(() => {
    let a = 0, b = 0, unset = 0;
    for (const sq of selectedPlayers.values()) {
      if (sq === "A") a++;
      else if (sq === "B") b++;
      else unset++;
    }
    return { a, b, unset, total: selectedPlayers.size };
  }, [selectedPlayers]);

  return (
    // 送出/刪除進行中時，整個畫面欄位與按鈕一律鎖定
    <fieldset
      disabled={isSubmitting}
      className="space-y-6 min-w-0 border-0 p-0 m-0"
    >
      {/* 頁首 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "create" ? "新增比賽" : "編輯比賽"}
          </h1>
          {mode === "edit" && initial?.updatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              最後更新：{initial.updatedByName ?? "—"} 於{" "}
              {new Date(initial.updatedAt).toLocaleString("zh-TW", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/match-logs")} disabled={isSubmitting}>
            取消
          </Button>
          {canEdit && (
            <Button onClick={onSubmit} disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-1.5" />
              {isSubmitting ? "儲存中…" : "儲存"}
            </Button>
          )}
        </div>
      </div>

      {/* xl 雙欄：左 = 比賽資訊，右 = 對戰 + 名單 */}
      <div className="xl:grid xl:grid-cols-[2fr_3fr] xl:gap-6 xl:items-start space-y-6 xl:space-y-0">
        {/* 左欄 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              比賽資訊
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">學年度</Label>
                <Input
                  type="number" min={1}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="例：110"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> 賽事起始日 *
                </Label>
                <DateInput value={matchDate} onChange={(v) => setMatchDate(v ?? "")} />
                {matchType === "Official" && (
                  <p className="text-[11px] text-muted-foreground">
                    跨日賽事可於各筆對戰另填實際日期；空白即視為本日。
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">種類</Label>
                <Select
                  value={matchType}
                  onChange={(e) => {
                    const next = e.target.value;
                    setMatchType(next);
                    setRows((prev) =>
                      prev.map((r) => {
                        const patch: Partial<GameRow> = {};
                        // 離開 Official → 清空各筆對戰日期（僅 Official 允許跨日）
                        if (next !== "Official" && r.matchDate) patch.matchDate = "";
                        // 切到 Friendly → 清空固定局分 / matchScore（局數改由 sets 或 manual 輸入）
                        if (next === "Friendly") {
                          patch.set1Our = ""; patch.set1Opp = "";
                          patch.set2Our = ""; patch.set2Opp = "";
                          patch.set3Our = ""; patch.set3Opp = "";
                          patch.matchScore = "";
                        }
                        // 離開 Friendly → 清空動態局列與手動局數
                        if (next !== "Friendly") {
                          if (r.sets.length > 0) patch.sets = [];
                          if (r.manualWins || r.manualLosses) {
                            patch.manualWins = "";
                            patch.manualLosses = "";
                          }
                        }
                        return Object.keys(patch).length > 0 ? { ...r, ...patch } : r;
                      }),
                    );
                  }}
                  className="h-9"
                >
                  <option value="">-</option>
                  {MATCH_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">比賽名稱</Label>
                <Input
                  value={matchName}
                  onChange={(e) => setMatchName(e.target.value)}
                  placeholder="例：聯賽第一輪"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">地點</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value.toUpperCase())}
                  className="uppercase"
                  placeholder="比賽地點"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">出賽隊數</Label>
                <div className="inline-flex rounded-md border border-input bg-background overflow-hidden">
                  <button
                    type="button"
                    onClick={() => changeSquadCount(1)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      !splitMode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    1 隊（不分隊）
                  </button>
                  <button
                    type="button"
                    onClick={() => changeSquadCount(2)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors border-l border-input",
                      splitMode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    2 隊（A / B）
                  </button>
                </div>
              </div>
              {splitMode ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">A 隊名次</Label>
                    <Input
                      value={ranking}
                      onChange={(e) => setRanking(e.target.value)}
                      placeholder="例：冠軍、第三名"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">B 隊名次</Label>
                    <Input
                      value={rankingB}
                      onChange={(e) => setRankingB(e.target.value)}
                      placeholder="例：第二名"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">名次</Label>
                  <Input
                    value={ranking}
                    onChange={(e) => setRanking(e.target.value)}
                    placeholder="例：冠軍、第三名"
                  />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">影片網址</Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">備註</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 右欄 */}
        <div className="space-y-6">
          {/* 對戰紀錄 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Swords className="h-4 w-4 text-primary" />
                    對戰紀錄
                    <Chip tone="outline" size="sm">{rows.length}</Chip>
                  </CardTitle>
                  {splitMode && (
                    <p className="text-xs text-muted-foreground mt-1">
                      分隊出賽：每筆對戰請選擇 A 或 B
                    </p>
                  )}
                </div>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={addRow} disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4 mr-1" /> 新增對戰
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {rows.map((row, idx) => (
                  <MatchRowCard
                    key={row.id ?? `new-${idx}`}
                    idx={idx}
                    row={row}
                    splitMode={splitMode}
                    canRemove={rows.length > 1}
                    showDate={matchType === "Official"}
                    eventStartDate={matchDate}
                    friendlyMode={matchType === "Friendly"}
                    onChange={(patch) => updateRow(idx, patch)}
                    onRemove={() => removeRow(idx)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 出賽名單 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    出賽名單
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {splitMode
                      ? "於 A / B 欄點擊球員加入該隊；再點一次移除"
                      : "點擊球員加入或移除此次出賽名單"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {splitMode ? (
                    <>
                      <Chip tone="primary" size="md">A {squadCounts.a}</Chip>
                      <Chip tone="info" size="md">B {squadCounts.b}</Chip>
                      {squadCounts.unset > 0 && (
                        <Chip tone="neutral" size="md">未指定 {squadCounts.unset}</Chip>
                      )}
                    </>
                  ) : (
                    <Chip tone="primary" size="md">已選 {squadCounts.total} 人</Chip>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <RosterPicker
                selected={selectedPlayers}
                onToggle={togglePlayer}
                splitMode={splitMode}
                onSquadChange={setPlayerSquad}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 底部動作列：刪除（編輯模式才有） */}
      {mode === "edit" && canDelete && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            onClick={onDeleteAll}
            disabled={isSubmitting}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            刪除整場比賽
          </Button>
        </div>
      )}
    </fieldset>
  );
}

// ── 編輯包裝 ────────────────────────────────────────────────────────
function EditWrapper({ id }: { id: number }) {
  const { data } = useQuery({
    queryKey: ["match-events", id, "detail"],
    queryFn: () => matchEventsApi.get(id),
  });
  if (!data) return <div className="text-muted-foreground p-6">載入中…</div>;
  return <MatchEventForm mode="edit" initial={data} />;
}

export default function MatchLogEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  if (isNew) return <MatchEventForm mode="create" />;
  return <EditWrapper id={Number(id)} />;
}
