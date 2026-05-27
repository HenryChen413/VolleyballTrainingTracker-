import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HandCoins,
  Pencil,
  Trash2,
  X,
  Inbox,
  Crown,
  Medal,
  Wallet,
  Users as UsersIcon,
  Receipt,
  Save,
  Settings2,
  Heart,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddFab } from "@/components/ui/add-fab";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { DateInput } from "@/components/DateInput";
import EmptyState from "@/components/EmptyState";
import {
  sponsorsApi,
  type Sponsor,
  type Sponsorship,
  type SponsorUpsert,
  type SponsorshipUpsert,
  SPONSOR_IDENTITY_LABEL,
  SPONSOR_IDENTITY_OPTIONS,
} from "@/api/sponsors";
import {
  playersApi,
  type Player,
  PLAYER_STATUS,
  PLAYER_STATUS_LABEL,
} from "@/api/players";
import { PERM, useAuthStore } from "@/stores/authStore";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { cn } from "@/lib/utils";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

function formatMoney(n: number): string {
  return `$${(n ?? 0).toLocaleString("en-US")}`;
}

function identityLabel(identity: number): string {
  return SPONSOR_IDENTITY_LABEL[identity] ?? "";
}

type IdentityTone = "navy" | "warning" | "info" | "success" | "neutral";
function identityTone(identity: number): IdentityTone {
  const label = identityLabel(identity);
  if (label === "校友") return "navy";
  if (label === "家長") return "warning";
  if (label === "團體") return "info";
  if (label === "廠商") return "success";
  return "neutral";
}

function statusSuffix(p: Player): string {
  if (p.isActive === PLAYER_STATUS.Active) return "";
  return ` (${PLAYER_STATUS_LABEL[p.isActive] ?? ""})`;
}

function getInitial(name: string): string {
  return name.trim().charAt(0) || "?";
}

// ---- 贊助紀錄表單 ----
interface ShipDraft {
  id: number | null;
  sponsorId: number | null;
  amount: string;
  occurredAt: string;
  purpose: string;
  notes: string;
}

function emptyShipDraft(): ShipDraft {
  return {
    id: null,
    sponsorId: null,
    amount: "",
    occurredAt: todayIso(),
    purpose: "",
    notes: "",
  };
}

// ---- 贊助者名冊表單 ----
interface SponsorDraft {
  id: number | null;
  playerId: number | null;
  displayName: string;
  identity: number;
  notes: string;
}

function emptySponsorDraft(): SponsorDraft {
  return {
    id: null,
    playerId: null,
    displayName: "",
    identity: 4,
    notes: "",
  };
}

export default function SponsorsPage() {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.can)(PERM.SponsorsEdit);

  const [filterSponsorId, setFilterSponsorId] = useState<number | "">("");

  // 贊助紀錄 Dialog
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [shipDraft, setShipDraft] = useState<ShipDraft>(emptyShipDraft());

  // 贊助者名冊 Dialog
  const [rosterOpen, setRosterOpen] = useState(false);
  const [sponsorDraft, setSponsorDraft] =
    useState<SponsorDraft>(emptySponsorDraft());

  const { data: sponsors } = useQuery({
    queryKey: ["sponsors"],
    queryFn: () => sponsorsApi.listSponsors(),
  });

  const { data: stats } = useQuery({
    queryKey: ["sponsor-stats"],
    queryFn: () => sponsorsApi.stats({ top: 10 }),
  });

  const { data: ships, isLoading: loadingShips } = useQuery({
    queryKey: ["sponsorships", filterSponsorId],
    queryFn: () =>
      sponsorsApi.listSponsorships({
        sponsorId: filterSponsorId === "" ? undefined : filterSponsorId,
      }),
  });

  const { data: allPlayers } = useQuery({
    queryKey: ["players", "all"],
    queryFn: () => playersApi.list({}),
  });

  // 名冊下拉：依名稱排序
  const sortedSponsors = useMemo(() => {
    return [...(sponsors ?? [])].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "zh-Hant"),
    );
  }, [sponsors]);

  // 球員下拉：現役 → 畢業 → 離隊
  const sortedPlayers = useMemo(() => {
    const rank = (s: number) =>
      s === PLAYER_STATUS.Active ? 0 : s === PLAYER_STATUS.Graduated ? 1 : 2;
    return [...(allPlayers ?? [])].sort((a, b) => {
      const r = rank(a.isActive) - rank(b.isActive);
      if (r !== 0) return r;
      const ja = a.jerseyNo ?? 999;
      const jb = b.jerseyNo ?? 999;
      if (ja !== jb) return ja - jb;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
  }, [allPlayers]);

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["sponsors"] }),
      qc.invalidateQueries({ queryKey: ["sponsor-stats"] }),
      qc.invalidateQueries({ queryKey: ["sponsorships"] }),
    ]);
  }

  // ---- 贊助紀錄 mutations ----
  const createShip = useMutation({
    mutationFn: (d: SponsorshipUpsert) => sponsorsApi.createSponsorship(d),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已新增贊助紀錄");
      closeShipDialog();
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "新增失敗"),
  });
  const updateShip = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SponsorshipUpsert }) =>
      sponsorsApi.updateSponsorship(id, data),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已更新");
      closeShipDialog();
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "更新失敗"),
  });
  const deleteShip = useMutation({
    mutationFn: (id: number) => sponsorsApi.removeSponsorship(id),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已刪除");
      closeShipDialog();
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "刪除失敗"),
  });

  // ---- 名冊 mutations ----
  const createSponsor = useMutation({
    mutationFn: (d: SponsorUpsert) => sponsorsApi.createSponsor(d),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已新增贊助者");
      setSponsorDraft(emptySponsorDraft());
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "新增失敗"),
  });
  const updateSponsor = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SponsorUpsert }) =>
      sponsorsApi.updateSponsor(id, data),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已更新贊助者");
      setSponsorDraft(emptySponsorDraft());
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "更新失敗"),
  });
  const deleteSponsor = useMutation({
    mutationFn: (id: number) => sponsorsApi.removeSponsor(id),
    onSuccess: async () => {
      await invalidateAll();
      showSuccess("已刪除贊助者");
      setSponsorDraft(emptySponsorDraft());
    },
    onError: (e: unknown) => showError(errMsg(e) ?? "刪除失敗"),
  });

  const busy =
    createShip.isPending ||
    updateShip.isPending ||
    deleteShip.isPending ||
    createSponsor.isPending ||
    updateSponsor.isPending ||
    deleteSponsor.isPending;

  // ---- 贊助紀錄 Dialog 操作 ----
  const openNewShip = () => {
    setShipDraft(emptyShipDraft());
    setShipDialogOpen(true);
  };
  const openEditShip = (s: Sponsorship) => {
    setShipDraft({
      id: s.id,
      sponsorId: s.sponsorId,
      amount: String(s.amount),
      occurredAt: formatDate(s.occurredAt),
      purpose: s.purpose ?? "",
      notes: s.notes ?? "",
    });
    setShipDialogOpen(true);
  };
  const closeShipDialog = () => setShipDialogOpen(false);

  const handleShipSubmit = () => {
    if (!shipDraft.sponsorId) return showError("請選擇贊助者");
    const amount = Number(shipDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return showError("金額需為正整數");
    if (!shipDraft.occurredAt) return showError("請填日期");
    const data: SponsorshipUpsert = {
      sponsorId: shipDraft.sponsorId,
      amount: Math.round(amount),
      occurredAt: shipDraft.occurredAt,
      purpose: shipDraft.purpose.trim() || null,
      notes: shipDraft.notes.trim() || null,
    };
    if (shipDraft.id == null) createShip.mutate(data);
    else updateShip.mutate({ id: shipDraft.id, data });
  };

  const handleShipDelete = async (s: Sponsorship) => {
    const res = await confirmAction(
      "刪除贊助紀錄？",
      `${formatDate(s.occurredAt)} ｜ ${s.sponsorName} ｜ ${formatMoney(s.amount)}`,
      "刪除",
      true,
    );
    if (res.isConfirmed) deleteShip.mutate(s.id);
  };

  // ---- 名冊 Dialog 操作 ----
  const openRoster = () => {
    setSponsorDraft(emptySponsorDraft());
    setRosterOpen(true);
  };
  const editSponsorInRoster = (s: Sponsor) => {
    setSponsorDraft({
      id: s.id,
      playerId: s.playerId,
      displayName: s.displayName,
      identity: s.identity,
      notes: s.notes ?? "",
    });
  };

  const handleSponsorSubmit = () => {
    if (!sponsorDraft.displayName.trim()) return showError("請填顯示名稱");
    const data: SponsorUpsert = {
      playerId: sponsorDraft.playerId,
      displayName: sponsorDraft.displayName.trim(),
      identity: sponsorDraft.identity,
      notes: sponsorDraft.notes.trim() || null,
    };
    if (sponsorDraft.id == null) createSponsor.mutate(data);
    else updateSponsor.mutate({ id: sponsorDraft.id, data });
  };

  const handleSponsorDelete = async (s: Sponsor) => {
    if (s.count > 0) return showError("此贊助者仍有贊助紀錄，請先刪除其紀錄");
    const res = await confirmAction(
      "刪除贊助者？",
      `${s.displayName}`,
      "刪除",
      true,
    );
    if (res.isConfirmed) deleteSponsor.mutate(s.id);
  };

  const onPickPlayer = (pid: number | null) => {
    setSponsorDraft((d) => {
      if (pid == null) return { ...d, playerId: null };
      const p = allPlayers?.find((x) => x.id === pid);
      const fillName =
        d.displayName.trim() === "" && p ? p.name : d.displayName;
      return { ...d, playerId: pid, displayName: fillName };
    });
  };

  // Ctrl/Cmd+S 在紀錄 Dialog 開啟時儲存
  useEffect(() => {
    if (!shipDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (!busy) handleShipSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipDialogOpen, shipDraft, busy]);

  // 排名：依累計金額（金額 > 0 才上榜）
  const ranked = useMemo(
    () =>
      [...(sponsors ?? [])]
        .filter((s) => s.totalAmount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount),
    [sponsors],
  );
  const podium = ranked.slice(0, 3);
  const wall = ranked.slice(3);

  return (
    <div className="space-y-10">
      {/* === Page Header === */}
      <SponsorsHeader canEdit={canEdit} onManage={openRoster} busy={busy} />

      {canEdit && (
        <AddFab label="新增贊助" onClick={openNewShip} disabled={busy} />
      )}

      {/* === Stat strip === */}
      <StatStrip
        totalAmount={stats?.totalAmount ?? 0}
        totalCount={stats?.totalCount ?? 0}
        sponsorCount={stats?.sponsorCount ?? 0}
      />

      {/* === Podium 或 Empty state === */}
      {ranked.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              compact
              icon={Crown}
              title="尚無贊助"
              description={
                canEdit ? "點右下「新增贊助」開始記錄" : "尚未有贊助紀錄"
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <PodiumSection podium={podium} />

          {/* === Thanks wall === */}
          {wall.length > 0 && <ThanksWall wall={wall} />}
        </>
      )}

      {/* === Records list === */}
      <RecordsList
        ships={ships ?? []}
        loading={loadingShips}
        canEdit={canEdit}
        busy={busy}
        sortedSponsors={sortedSponsors}
        filterSponsorId={filterSponsorId}
        onFilterChange={setFilterSponsorId}
        onEdit={openEditShip}
        onDelete={handleShipDelete}
      />

      {/* === 贊助紀錄 Dialog（保留原樣式） === */}
      <Dialog
        open={shipDialogOpen}
        onClose={closeShipDialog}
        size="lg"
        title={shipDraft.id == null ? "新增贊助" : `編輯贊助 #${shipDraft.id}`}
        footer={
          <>
            {shipDraft.id != null && (
              <Button
                variant="ghost"
                onClick={() => {
                  const s = ships?.find((x) => x.id === shipDraft.id);
                  if (s) handleShipDelete(s);
                }}
                disabled={busy}
                className="text-destructive hover:text-destructive mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" /> 刪除
              </Button>
            )}
            <Button variant="ghost" onClick={closeShipDialog} disabled={busy}>
              取消
            </Button>
            <Button onClick={handleShipSubmit} disabled={busy}>
              <Save className="h-4 w-4 mr-1" />
              {shipDraft.id == null ? "新增" : "儲存變更"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              贊助者
              <span className="ml-1 text-muted-foreground/70 text-xs">
                （沒有的話請先按上方「管理贊助者」新增）
              </span>
            </label>
            <select
              value={shipDraft.sponsorId ?? ""}
              onChange={(e) =>
                setShipDraft((d) => ({
                  ...d,
                  sponsorId:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— 選擇贊助者 —</option>
              {sortedSponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}（{identityLabel(s.identity)}）
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">金額（元）</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={shipDraft.amount}
                onChange={(e) =>
                  setShipDraft((d) => ({ ...d, amount: e.target.value }))
                }
                placeholder="例：2000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">日期</label>
              <DateInput
                value={shipDraft.occurredAt}
                onChange={(v) =>
                  setShipDraft((d) => ({ ...d, occurredAt: v ?? todayIso() }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              用途
              <span className="ml-1 text-muted-foreground/70 text-xs">
                （選填，最多 128 字）
              </span>
            </label>
            <Input
              value={shipDraft.purpose}
              onChange={(e) =>
                setShipDraft((d) => ({ ...d, purpose: e.target.value }))
              }
              maxLength={128}
              placeholder="例：隊服、場租、比賽報名費…"
            />
            {(stats?.recentPurposes?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground py-0.5">
                  最近常用：
                </span>
                {stats!.recentPurposes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setShipDraft((d) => ({ ...d, purpose: p }))}
                    className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              備註
              <span className="ml-1 text-muted-foreground/70 text-xs">
                （選填）
              </span>
            </label>
            <Textarea
              value={shipDraft.notes}
              onChange={(e) =>
                setShipDraft((d) => ({ ...d, notes: e.target.value }))
              }
              maxLength={256}
              rows={3}
              placeholder="致謝、匯款方式、後續事項…"
            />
          </div>
        </div>
      </Dialog>

      {/* === 贊助者名冊 Dialog（保留原樣式） === */}
      <Dialog
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        size="lg"
        title="管理贊助者名冊"
        footer={
          <Button variant="ghost" onClick={() => setRosterOpen(false)}>
            關閉
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">
              {sponsorDraft.id == null
                ? "新增贊助者"
                : `編輯贊助者 #${sponsorDraft.id}`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  連結人員
                  <span className="ml-1 text-muted-foreground/70 text-xs">
                    （選填；學長姊不在陣容可留空）
                  </span>
                </label>
                <select
                  value={sponsorDraft.playerId ?? ""}
                  onChange={(e) =>
                    onPickPlayer(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">— 不連結（外部人士）—</option>
                  {sortedPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.jerseyNo != null ? `#${p.jerseyNo} ` : ""}
                      {p.name}
                      {statusSuffix(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">顯示名稱</label>
                <Input
                  value={sponsorDraft.displayName}
                  onChange={(e) =>
                    setSponsorDraft((d) => ({
                      ...d,
                      displayName: e.target.value,
                    }))
                  }
                  maxLength={64}
                  placeholder="例：王小明 學姊"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">身分</label>
                <select
                  value={sponsorDraft.identity}
                  onChange={(e) =>
                    setSponsorDraft((d) => ({
                      ...d,
                      identity: Number(e.target.value),
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {SPONSOR_IDENTITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                備註
                <span className="ml-1 text-muted-foreground/70 text-xs">
                  （選填）
                </span>
              </label>
              <Input
                value={sponsorDraft.notes}
                onChange={(e) =>
                  setSponsorDraft((d) => ({ ...d, notes: e.target.value }))
                }
                maxLength={256}
                placeholder="聯絡方式、關係…"
              />
            </div>
            <div className="flex justify-end gap-2">
              {sponsorDraft.id != null && (
                <Button
                  variant="ghost"
                  onClick={() => setSponsorDraft(emptySponsorDraft())}
                  disabled={busy}
                >
                  取消編輯
                </Button>
              )}
              <Button onClick={handleSponsorSubmit} disabled={busy}>
                <Save className="h-4 w-4 mr-1" />
                {sponsorDraft.id == null ? "新增" : "儲存變更"}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">
              現有贊助者 {sponsors?.length ?? 0} 位
            </p>
            {(sponsors?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={Inbox}
                title="尚無贊助者"
                description="先在上方新增第一位贊助者"
              />
            ) : (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                {sortedSponsors.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium truncate">
                        {s.jerseyNo != null ? `#${s.jerseyNo} ` : ""}
                        {s.displayName}
                      </span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {identityLabel(s.identity)}
                      </span>
                      <span className="ml-2 text-xs tabular-nums text-warning">
                        {formatMoney(s.totalAmount)}
                        <span className="text-muted-foreground/70">
                          {" "}
                          / {s.count} 筆
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => editSponsorInRoster(s)}
                        disabled={busy}
                        title="編輯"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSponsorDelete(s)}
                        disabled={busy}
                        title="刪除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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

/* ============== Page Header ============== */

function SponsorsHeader({
  canEdit,
  onManage,
  busy,
}: {
  canEdit: boolean;
  onManage: () => void;
  busy: boolean;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-warning/15 text-warning shrink-0">
            <HandCoins className="h-[22px] w-[22px]" />
          </span>
          <h1 className="font-display text-[28px] sm:text-[36px] leading-[1.05] tracking-tight font-bold">
            隊費贊助榜
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          感謝每一位贊助隊費的學長姊、家長與廠商
        </p>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={onManage} disabled={busy}>
            <Settings2 className="h-4 w-4 mr-1.5" />
            管理贊助者
          </Button>
        </div>
      )}
    </header>
  );
}

/* ============== Stat Strip（簡潔版，無 trend/sparkline） ============== */

type StatTone = "warning" | "info";

function StatStrip({
  totalAmount,
  totalCount,
  sponsorCount,
}: {
  totalAmount: number;
  totalCount: number;
  sponsorCount: number;
}) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        icon={Wallet}
        tone="warning"
        label="累計贊助總額"
        value={formatMoney(totalAmount)}
        large
      />
      <StatCard
        icon={Receipt}
        tone="info"
        label="贊助筆數"
        value={String(totalCount)}
      />
      <StatCard
        icon={UsersIcon}
        tone="info"
        label="贊助人數"
        value={String(sponsorCount)}
      />
    </section>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  large,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: StatTone;
  label: string;
  value: string;
  large?: boolean;
}) {
  const toneIcon =
    tone === "warning" ? "bg-warning/15 text-warning" : "bg-info/10 text-info";
  return (
    <Card className="surface-soft transition-all hover:shadow-lift hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "grid place-items-center w-9 h-9 rounded-lg shrink-0",
              toneIcon,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-[12.5px] text-muted-foreground font-medium">
            {label}
          </p>
        </div>
        <div
          className={cn(
            "mt-4 font-numeric font-bold leading-none text-foreground tabular-nums",
            large ? "text-[28px] sm:text-[32px]" : "text-[32px] sm:text-[34px]",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== Avatar / Identity Chip ============== */

const AVATAR_TONE_CLASS: Record<
  "primary" | "warning" | "navy" | "info" | "success" | "neutral",
  string
> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  navy: "bg-navy/10 text-navy",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
};

function Avatar({
  initial,
  size = 56,
  tone = "primary",
  ring = false,
  className,
}: {
  initial: string;
  size?: number;
  tone?: keyof typeof AVATAR_TONE_CLASS;
  ring?: boolean;
  className?: string;
}) {
  const fontSize = Math.round(size * 0.4);
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full font-semibold shrink-0 select-none",
        AVATAR_TONE_CLASS[tone],
        ring && "ring-[3px] ring-card",
        className,
      )}
      style={{ width: size, height: size, fontSize, lineHeight: 1 }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function IdentityChip({ identity }: { identity: number }) {
  const tone = identityTone(identity);
  // Chip 元件支援的 tone: neutral/primary/navy/success/destructive/warning/info/outline
  return (
    <Chip tone={tone} size="sm">
      {identityLabel(identity)}
    </Chip>
  );
}

/* ============== Section Title（Podium / Wall 共用） ============== */

function SectionTitle({
  icon: Icon,
  tone = "warning",
  title,
  subtitle,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warning" | "primary" | "info";
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const toneIcon =
    tone === "warning"
      ? "bg-warning/15 text-warning"
      : tone === "info"
        ? "bg-info/10 text-info"
        : "bg-primary/10 text-primary";
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "grid place-items-center w-9 h-9 rounded-lg shrink-0",
            toneIcon,
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold tracking-tight whitespace-nowrap">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[12.5px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ============== Podium Section ============== */

function PodiumSection({ podium }: { podium: Sponsor[] }) {
  const first = podium[0];
  const second = podium[1];
  const third = podium[2];

  return (
    <section>
      <SectionTitle
        icon={Crown}
        tone="warning"
        title="贊助芳名榜"
        subtitle="累計金額排名前三的贊助者"
      />

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-end">
        {/* Mobile: 1 → 2 → 3 順序；Desktop: 2 / 1(中) / 3 */}
        {first && (
          <div className="md:order-2 md:-mt-4">
            <PodiumFirst sponsor={first} />
          </div>
        )}
        {second && (
          <div className="md:order-1">
            <PodiumSide sponsor={second} rank={2} />
          </div>
        )}
        {third && (
          <div className="md:order-3">
            <PodiumSide sponsor={third} rank={3} />
          </div>
        )}
      </div>
    </section>
  );
}

function PodiumFirst({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="relative">
      {/* 金光暈背景（脈動） */}
      <div
        className="absolute -inset-6 rounded-[28px] pointer-events-none anim-gold-pulse"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 35%, hsl(var(--warning) / 0.32), transparent 70%)",
          filter: "blur(6px)",
        }}
        aria-hidden
      />

      {/* NO. 1 浮動 ribbon */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full shadow-glow whitespace-nowrap"
        style={{
          background:
            "linear-gradient(180deg, hsl(38 95% 60%) 0%, hsl(38 92% 48%) 100%)",
        }}
      >
        <Crown className="h-3.5 w-3.5 text-white" />
        <span className="font-numeric font-bold text-[12px] text-white tracking-wide">
          NO. 1
        </span>
      </div>

      <div
        className="relative rounded-2xl border overflow-hidden px-6 pt-9 pb-7 shadow-lift"
        style={{
          borderColor: "hsl(var(--warning) / 0.45)",
          background:
            "linear-gradient(180deg, hsl(var(--warning) / 0.16) 0%, hsl(var(--card)) 55%, hsl(var(--card)) 100%)",
        }}
      >
        {/* 內部 highlight ring */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow:
              "inset 0 1px 0 hsl(var(--warning) / 0.4), inset 0 0 0 1px hsl(var(--warning) / 0.08)",
          }}
          aria-hidden
        />

        {/* 月桂 + Avatar + Sparkle */}
        <div className="relative flex items-center justify-center mt-1">
          <Laurel
            side="left"
            size={64}
            className="text-warning opacity-80 -mr-2"
          />
          <div className="relative">
            <Sparkle delay={0} x={-14} y={-10} size={12} />
            <Sparkle delay={500} x={72} y={-4} size={10} />
            <Sparkle delay={1000} x={-8} y={44} size={9} />
            <Sparkle delay={1500} x={68} y={48} size={11} />
            <Avatar
              initial={getInitial(sponsor.displayName)}
              size={72}
              tone="warning"
              ring
              className="shadow-glow"
            />
          </div>
          <Laurel
            side="right"
            size={64}
            className="text-warning opacity-80 -ml-2"
          />
        </div>

        {/* 名字 + identity */}
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {sponsor.jerseyNo != null && (
              <span className="font-numeric text-[13px] text-muted-foreground">
                #{sponsor.jerseyNo}
              </span>
            )}
            <h3 className="text-[20px] font-bold tracking-tight">
              {sponsor.displayName}
            </h3>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[12.5px] text-muted-foreground">
            <IdentityChip identity={sponsor.identity} />
            <span className="opacity-50">·</span>
            <span>
              累計{" "}
              <span className="font-numeric font-semibold text-foreground">
                {sponsor.count}
              </span>{" "}
              筆
            </span>
          </div>
        </div>

        {/* 金額 */}
        <div className="mt-5 text-center">
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            累計贊助金額
          </p>
          <div className="mt-1 font-numeric font-bold text-[42px] leading-none text-warning tabular-nums">
            {formatMoney(sponsor.totalAmount)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PodiumSide({ sponsor, rank }: { sponsor: Sponsor; rank: 2 | 3 }) {
  const colorVar = rank === 2 ? "silver" : "bronze";
  const color = `hsl(var(--${colorVar}))`;
  const borderColor = `hsl(var(--${colorVar}) / 0.45)`;
  return (
    <div className="relative rounded-2xl border border-border shadow-soft px-5 pt-7 pb-6 surface-soft transition-all hover:shadow-lift hover:-translate-y-0.5">
      {/* Rank badge 浮在卡片上方 */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full border bg-card"
        style={{ borderColor, color }}
      >
        <Medal className="h-4 w-4" style={{ color }} />
        <span
          className="font-numeric font-bold text-[12px] tracking-wide"
          style={{ color }}
        >
          NO. {rank}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <Avatar
          initial={getInitial(sponsor.displayName)}
          size={56}
          tone="primary"
        />
        <div className="mt-3 text-center">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {sponsor.jerseyNo != null && (
              <span className="font-numeric text-[12px] text-muted-foreground">
                #{sponsor.jerseyNo}
              </span>
            )}
            <h3 className="text-[16.5px] font-semibold">
              {sponsor.displayName}
            </h3>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <IdentityChip identity={sponsor.identity} />
            <span className="opacity-50">·</span>
            <span>
              <span className="font-numeric font-semibold text-foreground">
                {sponsor.count}
              </span>{" "}
              筆
            </span>
          </div>
        </div>
        <div className="mt-4 font-numeric font-bold text-[28px] leading-none text-warning tabular-nums">
          {formatMoney(sponsor.totalAmount)}
        </div>
      </div>
    </div>
  );
}

/* ============== Laurel（月桂半圈裝飾） ============== */

function Laurel({
  side = "left",
  size = 56,
  className,
}: {
  side?: "left" | "right";
  size?: number;
  className?: string;
}) {
  const leaves: [number, number, number][] = [
    [44, 14, -22],
    [38, 24, -18],
    [33, 34, -12],
    [30, 44, -4],
    [29, 54, 4],
    [29, 64, 14],
  ];
  return (
    <svg
      viewBox="0 0 64 80"
      width={size}
      height={(size * 80) / 64}
      className={className}
      style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}
      aria-hidden
    >
      <path
        d="M48 6 C 32 22, 24 42, 28 74"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {leaves.map(([cx, cy, rot], i) => (
        <g key={i} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
          <ellipse
            cx="-7"
            cy="0"
            rx="8"
            ry="3.2"
            fill="currentColor"
            opacity="0.85"
          />
          <ellipse
            cx="-7"
            cy="0"
            rx="8"
            ry="3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
            opacity="0.4"
          />
        </g>
      ))}
    </svg>
  );
}

/* ============== Sparkle（小星星裝飾） ============== */

function Sparkle({
  x,
  y,
  delay = 0,
  size = 12,
}: {
  x: number;
  y: number;
  delay?: number;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="absolute pointer-events-none anim-twinkle text-warning"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        animationDelay: `${delay}ms`,
      }}
      aria-hidden
    >
      <path
        d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

/* ============== Thanks Wall（紙張感感謝牆） ============== */

function ThanksWall({ wall }: { wall: Sponsor[] }) {
  return (
    <section>
      <SectionTitle
        icon={Heart}
        tone="warning"
        title="感謝這些人的支持"
        subtitle={`共 ${wall.length} 位贊助者一同支持球隊`}
        right={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-warning opacity-60" />
            依累計金額排序
          </span>
        }
      />
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {wall.map((s) => (
          <WallCard key={s.id} sponsor={s} />
        ))}
      </div>
    </section>
  );
}

function WallCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div
      className="group relative rounded-[0.875rem] border overflow-hidden px-4 py-4 transition-all hover:-translate-y-0.5 hover:shadow-soft"
      style={{
        borderColor: "hsl(var(--warning) / 0.18)",
        background:
          "linear-gradient(140deg, hsl(var(--warning) / 0.10) 0%, hsl(var(--card)) 60%)",
      }}
    >
      {/* 紙紋暈染（左上角微微暖色） */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, hsl(var(--warning) / 0.10), transparent 40%)",
        }}
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <Avatar
          initial={getInitial(sponsor.displayName)}
          size={42}
          tone="warning"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {sponsor.jerseyNo != null && (
              <span className="font-numeric text-[11px] text-muted-foreground">
                #{sponsor.jerseyNo}
              </span>
            )}
            <h4 className="text-sm font-semibold truncate">
              {sponsor.displayName}
            </h4>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <IdentityChip identity={sponsor.identity} />
            <span className="text-[11.5px] text-muted-foreground">
              <span className="font-numeric font-semibold text-foreground">
                {sponsor.count}
              </span>{" "}
              筆
            </span>
          </div>
        </div>
      </div>
      <div
        className="relative mt-3 pt-3 border-t border-dashed"
        style={{ borderColor: "hsl(var(--warning) / 0.22)" }}
      >
        <div className="font-numeric font-bold text-[20px] leading-none text-warning tabular-nums">
          {formatMoney(sponsor.totalAmount)}
        </div>
      </div>
    </div>
  );
}

/* ============== Records List ============== */

function RecordsList({
  ships,
  loading,
  canEdit,
  busy,
  sortedSponsors,
  filterSponsorId,
  onFilterChange,
  onEdit,
  onDelete,
}: {
  ships: Sponsorship[];
  loading: boolean;
  canEdit: boolean;
  busy: boolean;
  sortedSponsors: Sponsor[];
  filterSponsorId: number | "";
  onFilterChange: (v: number | "") => void;
  onEdit: (s: Sponsorship) => void;
  onDelete: (s: Sponsorship) => void;
}) {
  return (
    <Card className="surface-soft overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-semibold">贊助紀錄</h3>
          <Chip tone="neutral" size="sm">
            <span className="font-numeric font-semibold">{ships.length}</span>
            <span className="ml-1">筆</span>
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filterSponsorId}
              onChange={(e) =>
                onFilterChange(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="appearance-none pr-9 pl-3 h-9 rounded-lg border bg-card text-[13px] border-border hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">所有贊助者</option>
              {sortedSponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}（{identityLabel(s.identity)}）
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          {filterSponsorId !== "" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange("")}
            >
              <X className="h-3 w-3 mr-1" /> 清除
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-2 sm:px-3 py-2">
        {loading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : ships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <Inbox className="h-9 w-9 opacity-30 mb-2" />
            <p className="text-[13px]">尚無紀錄</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {ships.map((s, i) => (
              <li
                key={s.id}
                className={cn(i > 0 && "border-t border-dashed border-border")}
              >
                <RecordRow
                  rec={s}
                  canEdit={canEdit}
                  busy={busy}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function RecordRow({
  rec,
  canEdit,
  busy,
  onEdit,
  onDelete,
}: {
  rec: Sponsorship;
  canEdit: boolean;
  busy: boolean;
  onEdit: (s: Sponsorship) => void;
  onDelete: (s: Sponsorship) => void;
}) {
  return (
    <div className="group grid grid-cols-[88px_1fr_auto] sm:grid-cols-[110px_1fr_auto_auto] items-center gap-3 sm:gap-4 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors">
      <span className="font-numeric text-[12.5px] text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDate(rec.occurredAt)}
      </span>
      <div className="min-w-0 flex items-center gap-2 flex-wrap">
        {rec.sponsorJerseyNo != null && (
          <span className="font-numeric text-[12px] text-muted-foreground">
            #{rec.sponsorJerseyNo}
          </span>
        )}
        <span className="text-[13.5px] font-medium truncate">
          {rec.sponsorName}
        </span>
        <IdentityChip identity={rec.sponsorIdentity} />
        {rec.purpose && (
          <span className="hidden sm:inline text-xs text-muted-foreground">
            · {rec.purpose}
          </span>
        )}
      </div>
      <span className="font-numeric font-semibold text-sm text-warning tabular-nums whitespace-nowrap">
        {formatMoney(rec.amount)}
      </span>
      {canEdit && (
        <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onEdit(rec)}
            disabled={busy}
            title="編輯"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onDelete(rec)}
            disabled={busy}
            title="刪除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
