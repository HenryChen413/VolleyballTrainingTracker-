import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Droplets,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
  Users as UsersIcon,
  Volleyball,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import EmptyState from "@/components/EmptyState";
import { rolesApi, type Role, type RoleUpsert } from "@/api/roles";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { PAGE, PERM } from "@/stores/authStore";
import { cn } from "@/lib/utils";

// ── 對應表 ────────────────────────────────────────────────────────────────

interface PageMeta {
  key: string;
  label: string;
  icon: LucideIcon;
}

const PAGE_META: PageMeta[] = [
  { key: PAGE.Dashboard,   label: "儀表板",       icon: LayoutDashboard },
  { key: PAGE.Calendar,    label: "行事曆",       icon: CalendarDays },
  { key: PAGE.Players,     label: "選手",         icon: UsersIcon },
  { key: PAGE.Sessions,    label: "訓練紀錄",     icon: Dumbbell },
  { key: PAGE.MatchLogs,   label: "比賽紀錄",     icon: Volleyball },
  { key: PAGE.Drills,      label: "訓練項目",     icon: ListChecks },
  { key: PAGE.Crying,      label: "哭哭榜",       icon: Droplets },
  { key: PAGE.Board,       label: "留言板",       icon: MessageSquare },
  { key: PAGE.AdminUsers,  label: "使用者管理",   icon: UserCog },
  { key: PAGE.AdminRoles,  label: "角色管理",     icon: ShieldCheck },
  { key: PAGE.Profile,     label: "我的帳號",     icon: User },
];

interface PermMeta {
  key: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  tone?: "destructive";
  /** 啟用此權限時要自動勾上的對應頁面（沒有頁面權限，編輯權限沒意義） */
  relatedPage?: string;
}

const EDIT_PERMS: PermMeta[] = [
  { key: PERM.PlayersEdit,   label: "選手",     icon: UsersIcon,  desc: "新增、修改、畢業選手",     relatedPage: PAGE.Players },
  { key: PERM.SessionsEdit,  label: "訓練紀錄", icon: Dumbbell,   desc: "新增、修改、刪除訓練紀錄", relatedPage: PAGE.Sessions },
  { key: PERM.DrillsEdit,    label: "訓練項目", icon: ListChecks, desc: "新增、修改、停用訓練項目", relatedPage: PAGE.Drills },
  { key: PERM.MatchLogsEdit, label: "比賽紀錄", icon: Volleyball, desc: "新增、修改、刪除比賽紀錄", relatedPage: PAGE.MatchLogs },
];

const SPECIAL_PERMS: PermMeta[] = [
  {
    key: PERM.PlayersPurge,
    label: "永久刪除選手",
    icon: AlertTriangle,
    desc: "從資料庫永久移除，會清除歷史紀錄、不可復原",
    tone: "destructive",
    relatedPage: PAGE.Players,
  },
  { key: PERM.UsersManage, label: "使用者管理", icon: UserCog,       desc: "新增、修改、停用使用者", relatedPage: PAGE.AdminUsers },
  { key: PERM.RolesManage, label: "角色管理",   icon: ShieldCheck,   desc: "管理本頁的角色設定",     relatedPage: PAGE.AdminRoles },
  { key: PERM.BoardManage, label: "留言板管理", icon: MessageSquare, desc: "刪除任何人的貼文／回覆、置頂貼文", relatedPage: PAGE.Board },
];

const ALL_PERMS: PermMeta[] = [...EDIT_PERMS, ...SPECIAL_PERMS];

const SYSTEM_ROLE_ORDER = ["Admin", "Coach", "Captain", "ViceCaptain", "Player"];

const emptyDraft: RoleUpsert = {
  name: "",
  description: "",
  allowedPages: [],
  permissions: [],
};

// ── 主元件 ────────────────────────────────────────────────────────────────

export default function AdminRolesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: catalog } = useQuery({
    queryKey: ["roles-catalog"],
    queryFn: () => rolesApi.catalog(),
  });
  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
  });

  const [editing, setEditing] = useState<Role | null>(null);
  const [draft, setDraft] = useState<RoleUpsert>(emptyDraft);
  const [query, setQuery] = useState("");

  const startNew = () => {
    setEditing(null);
    setDraft({ ...emptyDraft });
  };
  const startEdit = (r: Role) => {
    setEditing(r);
    setDraft({
      name: r.name,
      description: r.description ?? "",
      allowedPages: [...r.allowedPages],
      permissions: [...r.permissions],
    });
  };

  // 第一次載入完成時自動選第一個角色（於 render 階段一次性執行，
  // 用旗標確保只跑一次，避免在 effect 內 setState）
  const [didAutoSelect, setDidAutoSelect] = useState(false);
  if (!didAutoSelect && roles && roles.length > 0) {
    setDidAutoSelect(true);
    startEdit(roles[0]);
  }

  // 排序：系統角色置頂，按 SYSTEM_ROLE_ORDER；自訂角色依 id
  const sortedRoles = useMemo(() => {
    if (!roles) return [];
    const sysIdx = (name: string) => {
      const i = SYSTEM_ROLE_ORDER.indexOf(name);
      return i === -1 ? 999 : i;
    };
    return [...roles].sort((a, b) => {
      if (a.isSystem && b.isSystem) return sysIdx(a.name) - sysIdx(b.name);
      if (a.isSystem) return -1;
      if (b.isSystem) return 1;
      return a.id - b.id;
    });
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedRoles;
    return sortedRoles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [sortedRoles, query]);

  // 知名權限的可選清單（從 catalog 過濾，避免後端有舊資料殘留）
  const knownPerms = useMemo(() => {
    const known = new Set(ALL_PERMS.map((p) => p.key));
    return new Set(catalog?.allPermissions.filter((p) => known.has(p)) ?? []);
  }, [catalog]);

  const togglePage = (p: string) =>
    setDraft((d) => ({
      ...d,
      allowedPages: d.allowedPages.includes(p)
        ? d.allowedPages.filter((x) => x !== p)
        : [...d.allowedPages, p],
    }));
  const togglePerm = (key: string) =>
    setDraft((d) => {
      const isOn = d.permissions.includes(key);
      if (isOn) {
        return { ...d, permissions: d.permissions.filter((x) => x !== key) };
      }
      // 啟用權限時，順帶把對應頁面也勾上（沒有頁面權限，編輯權限無從使用）
      const meta = ALL_PERMS.find((p) => p.key === key);
      const allowedPages =
        meta?.relatedPage && !d.allowedPages.includes(meta.relatedPage)
          ? [...d.allowedPages, meta.relatedPage]
          : d.allowedPages;
      return {
        ...d,
        permissions: [...d.permissions, key],
        allowedPages,
      };
    });

  const selectAll = () =>
    setDraft((d) => ({
      ...d,
      allowedPages: PAGE_META.map((p) => p.key),
      permissions: ALL_PERMS.filter((p) => knownPerms.has(p.key)).map(
        (p) => p.key,
      ),
    }));
  const clearAllSelections = () =>
    setDraft((d) => ({ ...d, allowedPages: [], permissions: [] }));

  const saveMut = useMutation({
    mutationFn: async (payload: RoleUpsert) => {
      if (editing) return rolesApi.update(editing.id, payload);
      return rolesApi.create(payload);
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ["roles"] });
      setEditing(saved);
      showSuccess("儲存成功");
    },
    onError: (e: unknown) => {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      showError(m ?? "儲存失敗");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => rolesApi.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["roles"] });
      setEditing(null);
      setDraft(emptyDraft);
      showSuccess("角色已刪除");
    },
    onError: (e: unknown) => {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      showError(m ?? "刪除失敗");
    },
  });

  const isSystem = editing?.isSystem === true;
  const isNewRole = editing === null;
  const canSave = useMemo(() => draft.name.trim().length >= 2, [draft.name]);
  const busy = saveMut.isPending || deleteMut.isPending;

  return (
    <div className="space-y-4">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">角色管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            設定每個角色可以看到哪些頁面、能執行哪些動作
          </p>
        </div>
      </div>

      {/* 主版面：左清單 / 右編輯區 */}
      <div className="xl:grid xl:grid-cols-[1fr_2fr] xl:gap-6 xl:items-start space-y-4 xl:space-y-0">
        {/* 左：角色清單 */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋角色…"
                  className="pl-8"
                />
              </div>
              <Button
                size="sm"
                onClick={startNew}
                disabled={busy}
                title="新增角色"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredRoles.length === 0 ? (
              <EmptyState
                compact
                icon={Shield}
                title={query ? "找不到符合的角色" : "尚無角色"}
              />
            ) : (
              <ul className="space-y-2">
                {filteredRoles.map((r) => {
                  const selected = editing?.id === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => startEdit(r)}
                        disabled={busy}
                        className={cn(
                          "group relative w-full text-left rounded-lg border bg-card p-3 transition-all",
                          "hover:border-primary/40 hover:shadow-sm",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          selected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border",
                        )}
                      >
                        {selected && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                          />
                        )}
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full",
                              r.isSystem
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">
                                {r.name}
                              </span>
                              {r.isSystem && (
                                <Chip tone="outline" size="sm">
                                  系統
                                </Chip>
                              )}
                            </div>
                            {r.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {r.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <Chip tone="navy" size="sm">
                                {r.userCount} 人
                              </Chip>
                              <Chip tone="info" size="sm">
                                {r.permissions.length} 權限
                              </Chip>
                              <Chip tone="neutral" size="sm">
                                {r.allowedPages.length} 頁
                              </Chip>
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 右：編輯區 */}
        <Card className={cn(isSystem && "ring-1 ring-primary/10")}>
          <CardContent className="p-0">
            {/* Header */}
            <div
              className={cn(
                "px-5 py-4 border-b",
                isSystem && "bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold truncate">
                      {isNewRole
                        ? "新增角色"
                        : editing?.name ?? "—"}
                    </h2>
                    {isSystem && (
                      <Chip tone="primary" size="sm">
                        <Lock className="h-3 w-3 mr-0.5" />
                        系統
                      </Chip>
                    )}
                  </div>
                  {!isNewRole && editing?.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {editing.description}
                    </p>
                  )}
                  {!isNewRole && editing && editing.userCount > 0 && (
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() =>
                        navigate(`/admin/users?roleId=${editing.id}`)
                      }
                    >
                      <UsersIcon className="h-3 w-3" />
                      使用此角色：{editing.userCount} 人
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => saveMut.mutate(draft)}
                    disabled={!canSave || busy}
                    size="sm"
                  >
                    {busy ? "儲存中…" : "儲存"}
                  </Button>
                  {!isNewRole && editing && !editing.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const warning =
                          editing.userCount > 0
                            ? `此角色目前有 ${editing.userCount} 位使用者，無法直接刪除，請先改派。`
                            : "此操作無法復原。";
                        const result = await confirmAction(
                          `確定要刪除角色「${editing.name}」？`,
                          warning,
                          "刪除",
                          true,
                        );
                        if (result.isConfirmed) deleteMut.mutate(editing.id);
                      }}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {isSystem && (
                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-background/50 rounded-md px-3 py-2">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    系統內建角色：名稱無法變更、無法刪除；權限與頁面仍可調整。
                  </span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-5 space-y-6">
              {/* 基本資料 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">名稱</Label>
                  <Input
                    id="roleName"
                    value={draft.name}
                    disabled={isSystem || busy}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    placeholder="例如：助理教練"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleDesc">描述</Label>
                  <Input
                    id="roleDesc"
                    value={draft.description ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    placeholder="這個角色的職責或對象"
                  />
                </div>
              </div>

              {/* 全局快捷：一鍵套用所有頁面+權限 */}
              <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  一鍵套用以下所有頁面、編輯權限與特殊權限
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    disabled={busy}
                  >
                    全選
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllSelections}
                    disabled={busy}
                  >
                    全清
                  </Button>
                </div>
              </div>

              {/* 可看到的頁面 */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">可看到的頁面</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    決定登入後左側選單與路由的可見性
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PAGE_META.map((p) => {
                    const Icon = p.icon;
                    const active = draft.allowedPages.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePage(p.key)}
                        disabled={busy}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          active
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 編輯權限 */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">編輯權限</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    打開即可對該資源做新增／修改／刪除
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EDIT_PERMS.map((p) => (
                    <PermRow
                      key={p.key}
                      meta={p}
                      checked={draft.permissions.includes(p.key)}
                      disabled={busy || !knownPerms.has(p.key)}
                      onToggle={() => togglePerm(p.key)}
                    />
                  ))}
                </div>
              </section>

              {/* 特殊權限 */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">特殊權限</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    破壞性／系統管理動作，授權前請特別確認
                  </p>
                </div>
                <div className="space-y-2">
                  {SPECIAL_PERMS.map((p) => (
                    <PermRow
                      key={p.key}
                      meta={p}
                      checked={draft.permissions.includes(p.key)}
                      disabled={busy || !knownPerms.has(p.key)}
                      onToggle={() => togglePerm(p.key)}
                    />
                  ))}
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── 子元件 ────────────────────────────────────────────────────────────────

function PermRow({
  meta,
  checked,
  disabled,
  onToggle,
}: {
  meta: PermMeta;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const Icon = meta.icon;
  const danger = meta.tone === "destructive";
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 transition-colors",
        "cursor-pointer hover:bg-accent/40",
        danger && "border-destructive/30",
        disabled && "opacity-50 cursor-not-allowed",
        checked && !danger && "border-primary/40 bg-primary/5",
        checked && danger && "border-destructive bg-destructive/5",
      )}
    >
      <div
        className={cn(
          "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md",
          danger
            ? "bg-destructive/10 text-destructive"
            : checked
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{meta.label}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        <Switch
          checked={checked}
          onCheckedChange={() => !disabled && onToggle()}
          disabled={disabled}
          aria-label={meta.label}
        />
      </div>
    </label>
  );
}
