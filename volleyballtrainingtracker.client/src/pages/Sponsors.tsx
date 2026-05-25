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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddFab } from "@/components/ui/add-fab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function statusSuffix(p: Player): string {
  if (p.isActive === PLAYER_STATUS.Active) return "";
  return ` (${PLAYER_STATUS_LABEL[p.isActive] ?? ""})`;
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
  const [sponsorDraft, setSponsorDraft] = useState<SponsorDraft>(
    emptySponsorDraft(),
  );

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

  // 球員下拉（連結用）：現役 → 畢業 → 離隊
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
    if (s.count > 0)
      return showError("此贊助者仍有贊助紀錄，請先刪除其紀錄");
    const res = await confirmAction(
      "刪除贊助者？",
      `${s.displayName}`,
      "刪除",
      true,
    );
    if (res.isConfirmed) deleteSponsor.mutate(s.id);
  };

  // 連結球員時自動帶入姓名（若名稱為空）
  const onPickPlayer = (pid: number | null) => {
    setSponsorDraft((d) => {
      if (pid == null) return { ...d, playerId: null };
      const p = allPlayers?.find((x) => x.id === pid);
      const fillName = d.displayName.trim() === "" && p ? p.name : d.displayName;
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

  // 感謝牆資料：以名冊（含累計金額）為準，只列出實際有贊助（金額 > 0）者，依金額排序
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HandCoins className="h-6 w-6 text-warning" />
            隊費贊助榜
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            感謝每一位贊助隊費的學長姊、家長與廠商
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openRoster} disabled={busy}>
              <Settings2 className="h-4 w-4 mr-1" /> 管理贊助者
            </Button>
          </div>
        )}
      </div>

      {canEdit && (
        <AddFab label="新增贊助" onClick={openNewShip} disabled={busy} />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="累計贊助總額"
          value={formatMoney(stats?.totalAmount ?? 0)}
          tone="warning"
        />
        <StatCard
          icon={<Receipt className="h-5 w-5" />}
          label="贊助筆數"
          value={String(stats?.totalCount ?? 0)}
          tone="info"
        />
        <StatCard
          icon={<UsersIcon className="h-5 w-5" />}
          label="贊助人數"
          value={String(stats?.sponsorCount ?? 0)}
          tone="info"
        />
      </div>

      {/* === 贊助芳名榜：前三名獎台 === */}
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
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
              <Crown className="h-4 w-4 text-warning" /> 贊助芳名榜
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              {/* 視覺上把第一名置中、稍大：sm 以上用 order 重排為 2-1-3 */}
              {podium.map((s, i) => (
                <PodiumCard key={s.id} sponsor={s} rank={i} />
              ))}
            </div>
          </div>

          {/* === 感謝牆：其餘贊助者卡片 === */}
          {wall.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                感謝這些人的支持
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {wall.map((s) => (
                  <WallCard key={s.id} sponsor={s} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* === 贊助紀錄（精簡列表，保留篩選與編輯） === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
            <span>
              贊助紀錄
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {ships?.length ?? 0} 筆
              </span>
            </span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <select
                value={filterSponsorId}
                onChange={(e) =>
                  setFilterSponsorId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="">所有贊助者</option>
                {sortedSponsors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}（{identityLabel(s.identity)}）
                  </option>
                ))}
              </select>
              {filterSponsorId !== "" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterSponsorId("")}
                >
                  <X className="h-4 w-4 mr-1" /> 清除
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {loadingShips && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!loadingShips && (ships?.length ?? 0) === 0 && (
            <EmptyState
              compact
              icon={Inbox}
              title="尚無紀錄"
              description={
                canEdit ? "點右下「新增贊助」開始記錄" : "尚未有贊助紀錄"
              }
            />
          )}
          {(ships ?? []).map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors"
            >
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 whitespace-nowrap">
                {formatDate(s.occurredAt)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">
                  {s.sponsorJerseyNo != null ? `#${s.sponsorJerseyNo} ` : ""}
                  {s.sponsorName}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {identityLabel(s.sponsorIdentity)}
                </span>
                {s.purpose && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {s.purpose}
                  </span>
                )}
              </span>
              <span className="font-semibold tabular-nums text-sm shrink-0 text-warning">
                {formatMoney(s.amount)}
              </span>
              {canEdit && (
                <div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEditShip(s)}
                    disabled={busy}
                    title="編輯"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleShipDelete(s)}
                    disabled={busy}
                    title="刪除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 贊助紀錄 Dialog */}
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
                    onClick={() =>
                      setShipDraft((d) => ({ ...d, purpose: p }))
                    }
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

      {/* 贊助者名冊 Dialog */}
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
          {/* 編輯/新增表單 */}
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

          {/* 名冊清單 */}
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

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "info" | "warning";
}) {
  const toneClass =
    tone === "warning" ? "bg-warning/10 text-warning" : "bg-info/10 text-info";
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3 h-full">
        <div
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-md shrink-0",
            toneClass,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
  const initial = name.trim().charAt(0) || "?";
  const dim = size === "lg" ? "h-14 w-14 text-2xl" : "h-11 w-11 text-lg";
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0",
        dim,
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}

// 前三名獎台卡：第 1 名金色、稍大並於 sm+ 置中（order 2-1-3）
function PodiumCard({ sponsor, rank }: { sponsor: Sponsor; rank: number }) {
  const META = [
    {
      Icon: Crown,
      accent: "text-warning",
      ring: "border-warning/40 bg-warning/5",
      order: "sm:order-2",
      emphasize: true,
    },
    {
      Icon: Medal,
      accent: "text-muted-foreground",
      ring: "border-border",
      order: "sm:order-1",
      emphasize: false,
    },
    {
      Icon: Medal,
      accent: "text-foreground/50",
      ring: "border-border",
      order: "sm:order-3",
      emphasize: false,
    },
  ];
  const meta = META[rank] ?? META[2];
  const { Icon } = meta;
  return (
    <Card className={cn("border", meta.ring, meta.order)}>
      <CardContent
        className={cn(
          "flex flex-col items-center text-center gap-1.5",
          meta.emphasize ? "py-5" : "py-4",
        )}
      >
        <div className="flex items-center gap-1">
          <Icon className={cn("h-5 w-5", meta.accent)} />
          <span className={cn("text-sm font-bold", meta.accent)}>
            {rank + 1}
          </span>
        </div>
        <Avatar name={sponsor.displayName} size={meta.emphasize ? "lg" : "md"} />
        <div className="min-w-0 w-full">
          <p className="font-semibold truncate">
            {sponsor.jerseyNo != null && (
              <span className="text-muted-foreground mr-1">
                #{sponsor.jerseyNo}
              </span>
            )}
            {sponsor.displayName}
          </p>
          <p className="text-xs text-muted-foreground">
            {identityLabel(sponsor.identity)} · {sponsor.count} 筆
          </p>
        </div>
        <p
          className={cn(
            "font-bold tabular-nums text-warning",
            meta.emphasize ? "text-2xl" : "text-xl",
          )}
        >
          {formatMoney(sponsor.totalAmount)}
        </p>
      </CardContent>
    </Card>
  );
}

// 感謝牆卡：第 4 名以後的贊助者
function WallCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <Card>
      <CardContent className="py-3 flex flex-col items-center text-center gap-1.5">
        <Avatar name={sponsor.displayName} />
        <div className="min-w-0 w-full">
          <p className="font-medium text-sm truncate">
            {sponsor.jerseyNo != null && (
              <span className="text-muted-foreground mr-1">
                #{sponsor.jerseyNo}
              </span>
            )}
            {sponsor.displayName}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {identityLabel(sponsor.identity)} · {sponsor.count} 筆
          </p>
        </div>
        <p className="font-semibold tabular-nums text-warning">
          {formatMoney(sponsor.totalAmount)}
        </p>
      </CardContent>
    </Card>
  );
}
