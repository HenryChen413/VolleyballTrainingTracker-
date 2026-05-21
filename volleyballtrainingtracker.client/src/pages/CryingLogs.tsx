import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Droplets,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Inbox,
  Crown,
  Trophy,
  Users as UsersIcon,
  Save,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { DateInput } from "@/components/DateInput";
import EmptyState from "@/components/EmptyState";
import {
  cryingApi,
  type CryingLog,
  type CryingLogUpsert,
} from "@/api/crying";
import {
  playersApi,
  type Player,
  PLAYER_STATUS,
  PLAYER_STATUS_LABEL,
} from "@/api/players";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { cn } from "@/lib/utils";

interface DraftState {
  id: number | null;
  occurredAt: string;
  crierPlayerId: number | null;
  reason: string;
  notes: string;
  scorerPlayerIds: number[];
  scorerExternalNames: string[];
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function emptyDraft(): DraftState {
  return {
    id: null,
    occurredAt: todayIso(),
    crierPlayerId: null,
    reason: "",
    notes: "",
    scorerPlayerIds: [],
    scorerExternalNames: [],
  };
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function playerLabel(p: { name: string; jerseyNo: number | null }): string {
  return p.jerseyNo != null ? `#${p.jerseyNo} ${p.name}` : p.name;
}

// 非現役球員在表單中標示狀態（畢/離），現役不標
function statusSuffix(p: Player): string {
  if (p.isActive === PLAYER_STATUS.Active) return "";
  return ` (${PLAYER_STATUS_LABEL[p.isActive] ?? ""})`;
}

export default function CryingLogsPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [externalDraft, setExternalDraft] = useState("");

  // 篩選：哭者用 playerId；加分者用 token（p:<id> / e:<name>）
  const [filterCrierId, setFilterCrierId] = useState<number | "">("");
  const [filterScorer, setFilterScorer] = useState<string>("");

  const scorerFilterParams = useMemo(() => {
    if (!filterScorer) return {};
    if (filterScorer.startsWith("p:"))
      return { culpritId: Number(filterScorer.slice(2)) };
    if (filterScorer.startsWith("e:"))
      return { culpritName: filterScorer.slice(2) };
    return {};
  }, [filterScorer]);

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["crying-logs", filterCrierId, filterScorer],
    queryFn: () =>
      cryingApi.list({
        crierId: filterCrierId === "" ? undefined : filterCrierId,
        ...scorerFilterParams,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ["crying-stats"],
    queryFn: () => cryingApi.stats({ top: 10 }),
  });

  // 篩選下拉資料源：實際出現在紀錄中的人（含離隊/畢業/外部）
  const { data: filterOptions } = useQuery({
    queryKey: ["crying-filter-options"],
    queryFn: () => cryingApi.filterOptions(),
  });

  // 表單可選球員：全體（含現役/畢業/離隊）
  const { data: allPlayers } = useQuery({
    queryKey: ["players", "all"],
    queryFn: () => playersApi.list({}),
  });

  const playerById = useMemo(() => {
    const m = new Map<number, Player>();
    for (const p of allPlayers ?? []) m.set(p.id, p);
    return m;
  }, [allPlayers]);

  // 現役優先 → 畢業 → 離隊；同段內依背號、姓名
  const sortedFormPlayers = useMemo(() => {
    const statusRank = (s: number) =>
      s === PLAYER_STATUS.Active ? 0 : s === PLAYER_STATUS.Graduated ? 1 : 2;
    const arr = [...(allPlayers ?? [])];
    arr.sort((a, b) => {
      const sr = statusRank(a.isActive) - statusRank(b.isActive);
      if (sr !== 0) return sr;
      const ja = a.jerseyNo ?? 999;
      const jb = b.jerseyNo ?? 999;
      if (ja !== jb) return ja - jb;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
    return arr;
  }, [allPlayers]);

  const createMut = useMutation({
    mutationFn: (data: CryingLogUpsert) => cryingApi.create(data),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已新增哭哭紀錄");
      closeDialog();
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "新增失敗"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CryingLogUpsert }) =>
      cryingApi.update(id, data),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已更新");
      closeDialog();
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "更新失敗"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => cryingApi.remove(id),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已刪除");
      closeDialog();
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "刪除失敗"),
  });

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["crying-logs"] }),
      qc.invalidateQueries({ queryKey: ["crying-stats"] }),
      qc.invalidateQueries({ queryKey: ["crying-filter-options"] }),
    ]);
  }

  const openNew = () => {
    setDraft(emptyDraft());
    setExternalDraft("");
    setDialogOpen(true);
  };

  const openEdit = (log: CryingLog) => {
    setDraft({
      id: log.id,
      occurredAt: formatDate(log.occurredAt),
      crierPlayerId: log.crierPlayerId,
      reason: log.reason,
      notes: log.notes ?? "",
      scorerPlayerIds: log.scorers
        .filter((s) => s.kind === "player" && s.playerId != null)
        .map((s) => s.playerId as number),
      scorerExternalNames: log.scorers
        .filter((s) => s.kind === "external")
        .map((s) => s.name),
    });
    setExternalDraft("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setExternalDraft("");
  };

  const handleSubmit = () => {
    if (!draft.occurredAt) return showError("請填日期");
    if (!draft.crierPlayerId) return showError("請選擇哭哭的人");
    if (!draft.reason.trim()) return showError("請填寫原因");
    const data: CryingLogUpsert = {
      occurredAt: draft.occurredAt,
      crierPlayerId: draft.crierPlayerId,
      reason: draft.reason.trim(),
      notes: draft.notes.trim() || null,
      scorerPlayerIds: draft.scorerPlayerIds.filter(
        (id) => id !== draft.crierPlayerId,
      ),
      scorerExternalNames: draft.scorerExternalNames,
    };
    if (draft.id == null) createMut.mutate(data);
    else updateMut.mutate({ id: draft.id, data });
  };

  const handleDelete = async (log: CryingLog) => {
    const res = await confirmAction(
      "刪除哭哭紀錄？",
      `${formatDate(log.occurredAt)}　${log.crierName}　${log.reason}`,
      "刪除",
      true,
    );
    if (res.isConfirmed) deleteMut.mutate(log.id);
  };

  const togglePlayerScorer = (pid: number) => {
    setDraft((d) => {
      if (d.scorerPlayerIds.includes(pid))
        return {
          ...d,
          scorerPlayerIds: d.scorerPlayerIds.filter((x) => x !== pid),
        };
      return { ...d, scorerPlayerIds: [...d.scorerPlayerIds, pid] };
    });
  };

  const addExternalScorer = () => {
    const name = externalDraft.trim();
    if (!name) return;
    if (name.length > 64) return showError("名字最長 64 字");
    setDraft((d) =>
      d.scorerExternalNames.includes(name)
        ? d
        : { ...d, scorerExternalNames: [...d.scorerExternalNames, name] },
    );
    setExternalDraft("");
  };

  const removeExternalScorer = (name: string) => {
    setDraft((d) => ({
      ...d,
      scorerExternalNames: d.scorerExternalNames.filter((n) => n !== name),
    }));
  };

  // Ctrl/Cmd+S 在 Dialog 開啟時儲存
  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (!busy) handleSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, draft, busy]);

  const filterActive = filterCrierId !== "" || filterScorer !== "";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Droplets className="h-6 w-6 text-info" />
            哭哭紀錄表
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            紀錄誰哭了、誰加分、為什麼 — 可看就可編輯
          </p>
        </div>
        <Button onClick={openNew} disabled={busy}>
          <Plus className="h-4 w-4 mr-1" /> 新增哭哭
        </Button>
      </div>

      {/* Summary cards：總次數 + 哭王 TOP3 + 加分王 TOP3 + 經典組合 TOP3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <TotalCard total={stats?.totalLogs ?? 0} />
        <Top3MiniCard
          title="哭王 TOP 3"
          icon={<Crown className="h-4 w-4 text-warning" />}
          tone="info"
          rows={(stats?.topCriers ?? []).map((r) => ({
            key: `${r.kind}-${r.playerId ?? r.name}`,
            label: r.name,
            sub: r.jerseyNo != null ? `#${r.jerseyNo}` : "",
            count: r.count,
          }))}
        />
        <Top3MiniCard
          title="加分王 TOP 3"
          icon={<Trophy className="h-4 w-4 text-warning" />}
          tone="warning"
          rows={(stats?.topScorers ?? []).map((r) => ({
            key: `${r.kind}-${r.playerId ?? r.name}`,
            label: r.name,
            sub:
              r.kind === "external"
                ? "(外)"
                : r.jerseyNo != null
                  ? `#${r.jerseyNo}`
                  : "",
            count: r.count,
          }))}
        />
        <Top3MiniCard
          title="經典組合 TOP 3"
          icon={<UsersIcon className="h-4 w-4 text-info" />}
          tone="info"
          rows={(stats?.topPairs ?? []).map((r) => ({
            key: `${r.crierId}-${r.scorerKind}-${r.scorerId ?? r.scorerName}`,
            label: `${r.crierName} ← ${r.scorerName}`,
            sub: r.scorerKind === "external" ? "(外)" : "",
            count: r.count,
          }))}
        />
      </div>

      {/* 清單（全寬） */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              紀錄清單
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {logs?.length ?? 0} 筆
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filter row（來源 = 實際紀錄） */}
          <div className="flex flex-wrap gap-2 text-sm">
            <select
              value={filterCrierId}
              onChange={(e) =>
                setFilterCrierId(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="">所有哭者</option>
              {(filterOptions?.criers ?? []).map((c) => (
                <option key={c.playerId} value={c.playerId}>
                  {playerLabel(c)}
                </option>
              ))}
            </select>
            <select
              value={filterScorer}
              onChange={(e) => setFilterScorer(e.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="">所有加分者</option>
              {(filterOptions?.scorers ?? []).map((s) => {
                const token =
                  s.kind === "player" ? `p:${s.playerId}` : `e:${s.name}`;
                return (
                  <option key={token} value={token}>
                    {s.kind === "external"
                      ? `${s.name}（外）`
                      : playerLabel(s)}
                  </option>
                );
              })}
            </select>
            {filterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCrierId("");
                  setFilterScorer("");
                }}
              >
                <X className="h-4 w-4 mr-1" /> 清除
              </Button>
            )}
          </div>

          {loadingLogs && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {!loadingLogs && (logs?.length ?? 0) === 0 && (
            <EmptyState
              compact
              icon={Inbox}
              title="尚無紀錄"
              description="點右上「新增哭哭」開始記錄"
            />
          )}
          <ul className="space-y-2">
            {(logs ?? []).map((log) => (
              <li
                key={log.id}
                className="group rounded-md border p-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {formatDate(log.occurredAt)}
                      </span>
                      <Chip tone="info" size="sm">
                        {log.crierJerseyNo != null
                          ? `#${log.crierJerseyNo} `
                          : ""}
                        {log.crierName}
                      </Chip>
                    </div>
                    <p className="font-medium mt-1 line-clamp-2">{log.reason}</p>
                    {log.scorers.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-muted-foreground">加分：</span>
                        {log.scorers.map((s, i) => (
                          <Chip
                            key={`${s.kind}-${s.playerId ?? s.name}-${i}`}
                            tone={s.kind === "player" ? "warning" : "outline"}
                            size="sm"
                          >
                            {s.kind === "player" && s.jerseyNo != null
                              ? `#${s.jerseyNo} `
                              : ""}
                            {s.name}
                            {s.kind === "external" && (
                              <span className="ml-1 text-muted-foreground/70">
                                (外)
                              </span>
                            )}
                          </Chip>
                        ))}
                      </div>
                    )}
                    {log.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {log.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(log)}
                      disabled={busy}
                      title="編輯"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(log)}
                      disabled={busy}
                      title="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 新增 / 編輯 Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        size="lg"
        title={draft.id == null ? "新增哭哭紀錄" : `編輯紀錄 #${draft.id}`}
        footer={
          <>
            {draft.id != null && (
              <Button
                variant="ghost"
                onClick={() => {
                  const log = logs?.find((l) => l.id === draft.id);
                  if (log) handleDelete(log);
                }}
                disabled={busy}
                className="text-destructive hover:text-destructive mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" /> 刪除
              </Button>
            )}
            <Button variant="ghost" onClick={closeDialog} disabled={busy}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              <Save className="h-4 w-4 mr-1" />
              {draft.id == null ? "新增" : "儲存變更"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">日期</label>
              <DateInput
                value={draft.occurredAt}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, occurredAt: v ?? todayIso() }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">哭哭的人</label>
              <select
                value={draft.crierPlayerId ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    crierPlayerId:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— 選擇 —</option>
                {sortedFormPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {playerLabel(p)}
                    {statusSuffix(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              原因
              <span className="ml-1 text-muted-foreground/70 text-xs">
                （必填，最多 256 字）
              </span>
            </label>
            <Input
              value={draft.reason}
              onChange={(e) =>
                setDraft((d) => ({ ...d, reason: e.target.value }))
              }
              maxLength={256}
              placeholder="例：被吼、漏接被怪、體能課太累…"
            />
            {(stats?.recentReasons?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground py-0.5">
                  最近常用：
                </span>
                {stats!.recentReasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, reason: r }))}
                    className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 加分者：球員多選 + 外部自由輸入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              加分者
              <span className="ml-1 text-muted-foreground/70 text-xs">
                （可多選、可空；哭者自己會自動排除）
              </span>
            </label>

            <div className="rounded-md border p-2 space-y-3">
              {/* 已選 chips */}
              {(draft.scorerPlayerIds.length > 0 ||
                draft.scorerExternalNames.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {draft.scorerPlayerIds.map((id) => {
                    const p = playerById.get(id);
                    return (
                      <button
                        key={`p-${id}`}
                        type="button"
                        onClick={() => togglePlayerScorer(id)}
                        className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning px-2 py-0.5 text-xs hover:bg-warning/25 transition-colors"
                      >
                        {p ? playerLabel(p) : `#${id}`}
                        <X className="h-3 w-3" />
                      </button>
                    );
                  })}
                  {draft.scorerExternalNames.map((name) => (
                    <button
                      key={`e-${name}`}
                      type="button"
                      onClick={() => removeExternalScorer(name)}
                      className="inline-flex items-center gap-1 rounded-full border border-warning/40 text-foreground px-2 py-0.5 text-xs hover:bg-warning/10 transition-colors"
                      title="外部加分者"
                    >
                      {name}
                      <span className="text-muted-foreground/70">(外)</span>
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              {/* 球員多選網格（含畢業/離隊） */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  球員（含畢業 / 離隊）
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                  {sortedFormPlayers
                    .filter((p) => p.id !== draft.crierPlayerId)
                    .map((p) => {
                      const selected = draft.scorerPlayerIds.includes(p.id);
                      const inactive = p.isActive !== PLAYER_STATUS.Active;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlayerScorer(p.id)}
                          className={cn(
                            "relative text-left rounded-md border px-2 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-warning bg-warning/15 text-warning"
                              : "border-border hover:bg-accent/50",
                          )}
                        >
                          {selected && (
                            <Check className="absolute top-1 right-1 h-3 w-3" />
                          )}
                          <span className="pr-4 truncate block">
                            {playerLabel(p)}
                            {inactive && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {statusSuffix(p).trim()}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 外部自由輸入 */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  外部加分者（非球員）
                  <span className="ml-1 text-muted-foreground/70">
                    — 填寫後須先按右側「加入」才會生效
                  </span>
                </p>
                <div className="flex gap-2">
                  <Input
                    value={externalDraft}
                    onChange={(e) => setExternalDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addExternalScorer();
                      }
                    }}
                    maxLength={64}
                    placeholder="例：對手、教練、家人…"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addExternalScorer}
                    disabled={!externalDraft.trim()}
                  >
                    <UserPlus className="h-4 w-4 mr-1" /> 加入
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              備註
              <span className="ml-1 text-muted-foreground/70 text-xs">
                （選填）
              </span>
            </label>
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              maxLength={1024}
              rows={3}
              placeholder="情境、後續處理、需要關心的點…"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
}

interface MiniRow {
  key: string | number;
  label: string;
  sub?: string;
  count: number;
}

function Top3MiniCard({
  title,
  icon,
  rows,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  rows: MiniRow[];
  tone: "info" | "warning";
}) {
  const top3 = rows.slice(0, 3);
  const max = Math.max(1, ...top3.map((r) => r.count));
  const medalColors = [
    "text-warning",
    "text-muted-foreground",
    "text-foreground/60",
  ];
  const barTone = tone === "warning" ? "bg-warning/60" : "bg-info/60";

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
          {icon}
          <span>{title}</span>
        </div>
        {top3.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            尚無資料
          </p>
        ) : (
          <ol className="space-y-1.5">
            {top3.map((r, i) => (
              <li key={r.key} className="text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-4 font-bold tabular-nums shrink-0",
                      medalColors[i],
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate">
                    {r.label}
                    {r.sub && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {r.sub}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums text-sm">
                    {r.count}
                  </span>
                </div>
                <div className="h-1 mt-0.5 ml-6 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full", barTone)}
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function TotalCard({ total }: { total: number }) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3 h-full">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-info/10 text-info shrink-0">
          <Droplets className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">總哭哭次數</p>
          <p className="text-2xl font-bold tabular-nums">{total}</p>
        </div>
      </CardContent>
    </Card>
  );
}
