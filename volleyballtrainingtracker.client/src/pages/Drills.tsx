import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Inbox,
  Search,
  X,
  Volleyball,
  Send,
  Hand,
  Target,
  Swords,
  Shield,
  Activity,
  Dumbbell,
  Sparkles,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { drillsApi, type Drill, type DrillUpsert } from "@/api/drills";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { PERM, useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

type Tone = NonNullable<ChipProps["tone"]>;

interface CategoryMeta {
  value: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  /** chip 啟用態的填色 class */
  activeClass: string;
  /** 列左側色條 class */
  barClass: string;
  /** 標題 icon 容器（淡底色 + 文字色） */
  iconBoxClass: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    value: "Basic",
    label: "基礎",
    icon: Volleyball,
    tone: "neutral",
    activeClass: "bg-foreground text-background",
    barClass: "bg-muted-foreground",
    iconBoxClass: "bg-muted text-muted-foreground",
  },
  {
    value: "Serve",
    label: "發球",
    icon: Send,
    tone: "info",
    activeClass: "bg-info text-info-foreground",
    barClass: "bg-info",
    iconBoxClass: "bg-info/10 text-info",
  },
  {
    value: "Pass",
    label: "接發球",
    icon: Hand,
    tone: "navy",
    activeClass: "bg-navy text-navy-foreground",
    barClass: "bg-navy",
    iconBoxClass: "bg-navy/10 text-navy",
  },
  {
    value: "Set",
    label: "舉球",
    icon: Target,
    tone: "primary",
    activeClass: "bg-primary text-primary-foreground",
    barClass: "bg-primary",
    iconBoxClass: "bg-primary/10 text-primary",
  },
  {
    value: "Attack",
    label: "攻擊",
    icon: Swords,
    tone: "destructive",
    activeClass: "bg-destructive text-destructive-foreground",
    barClass: "bg-destructive",
    iconBoxClass: "bg-destructive/10 text-destructive",
  },
  {
    value: "Block",
    label: "攔網",
    icon: Shield,
    tone: "warning",
    activeClass: "bg-warning text-warning-foreground",
    barClass: "bg-warning",
    iconBoxClass: "bg-warning/15 text-warning",
  },
  {
    value: "Dig",
    label: "防守",
    icon: Activity,
    tone: "success",
    activeClass: "bg-success text-success-foreground",
    barClass: "bg-success",
    iconBoxClass: "bg-success/10 text-success",
  },
  {
    value: "Fitness",
    label: "體能",
    icon: Dumbbell,
    tone: "outline",
    activeClass: "bg-foreground text-background",
    barClass: "bg-foreground/60",
    iconBoxClass: "border border-border text-foreground",
  },
];

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.value, c]));

const NEW_THRESHOLD_DAYS = 7;

const emptyDraft: DrillUpsert = {
  name: "",
  category: CATEGORIES[0].value,
  description: "",
  isActive: true,
};

function isRecentlyCreated(createdAt: string | undefined | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const ageMs = Date.now() - created;
  return ageMs >= 0 && ageMs <= NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}

export default function DrillsPage() {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.can(PERM.DrillsEdit));
  const canCreate = canEdit;
  const canUpdate = canEdit;
  const canDelete = canEdit;

  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");

  const { data: drills, isLoading } = useQuery({
    queryKey: ["drills", "manage", showInactive],
    queryFn: () => drillsApi.list(!showInactive ? true : false),
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Drill | null>(null);
  const [draft, setDraft] = useState<DrillUpsert>(emptyDraft);
  const isNew = editing === null;
  const searchRef = useRef<HTMLInputElement>(null);

  const startNew = useCallback(
    (preset?: Partial<DrillUpsert>) => {
      setEditing(null);
      setDraft({ ...emptyDraft, ...(preset ?? {}) });
      setEditorOpen(true);
    },
    [],
  );
  const startEdit = useCallback((d: Drill) => {
    setEditing(d);
    setDraft({
      name: d.name,
      category: d.category,
      description: d.description ?? "",
      isActive: d.isActive,
    });
    setEditorOpen(true);
  }, []);
  const closeEditor = useCallback(() => {
    setEditorOpen(false);
  }, []);

  useEffect(() => {
    if (editing) {
      const fresh = drills?.find((d) => d.id === editing.id);
      if (!fresh) {
        setEditing(null);
        setDraft({ ...emptyDraft });
        setEditorOpen(false);
      }
    }
  }, [drills, editing]);

  const totals = useMemo(() => {
    const all = drills ?? [];
    const active = all.filter((d) => d.isActive).length;
    return { total: all.length, inactive: all.length - active };
  }, [drills]);

  const countsByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of drills ?? []) {
      m.set(d.category, (m.get(d.category) ?? 0) + 1);
    }
    return m;
  }, [drills]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return (drills ?? []).filter((d) => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (!kw) return true;
      const hay = `${d.name} ${d.description ?? ""}`.toLowerCase();
      return hay.includes(kw);
    });
  }, [drills, search, categoryFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, Drill[]>();
    for (const c of CATEGORIES) m.set(c.value, []);
    for (const d of filtered) {
      const arr = m.get(d.category) ?? [];
      arr.push(d);
      m.set(d.category, arr);
    }
    return m;
  }, [filtered]);

  const saveMut = useMutation({
    mutationFn: async (payload: DrillUpsert) => {
      if (editing) return drillsApi.update(editing.id, payload);
      return drillsApi.create(payload);
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ["drills"] });
      setEditing(saved);
      setEditorOpen(false);
      showSuccess("儲存成功");
    },
    onError: (e: unknown) => {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      showError(m ?? "儲存失敗");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => drillsApi.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["drills"] });
      setEditing(null);
      setDraft({ ...emptyDraft });
      setEditorOpen(false);
      showSuccess("項目已停用");
    },
    onError: (e: unknown) => {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      showError(m ?? "刪除失敗");
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ d, next }: { d: Drill; next: boolean }) =>
      drillsApi.update(d.id, {
        name: d.name,
        category: d.category,
        description: d.description,
        isActive: next,
      }),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["drills"] });
      showSuccess(vars.next ? "已啟用" : "已停用");
    },
    onError: (e: unknown) => {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      showError(m ?? "更新失敗");
    },
  });

  const canSave = useMemo(
    () => draft.name.trim().length >= 1 && !!draft.category,
    [draft.name, draft.category],
  );
  const canSubmit = isNew ? canCreate : canUpdate;
  const busy =
    saveMut.isPending || deleteMut.isPending || toggleActiveMut.isPending;

  const handleDuplicate = useCallback(
    (d: Drill) => {
      if (!canCreate) return;
      startNew({
        name: `${d.name} 複本`,
        category: d.category,
        description: d.description ?? "",
        isActive: true,
      });
    },
    [canCreate, startNew],
  );

  // 鍵盤快捷鍵：N 新增、/ 聚焦搜尋（編輯框打字時不觸發；Esc 由 Dialog 自處理）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping) return;
      if (editorOpen) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.key === "n" || e.key === "N") && canCreate) {
        e.preventDefault();
        startNew();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canCreate, editorOpen, startNew]);

  const handleSave = () => {
    saveMut.mutate({
      name: draft.name.trim(),
      category: draft.category,
      description: draft.description?.trim() ? draft.description.trim() : null,
      isActive: draft.isActive,
    });
  };

  const handleDelete = async (d: Drill) => {
    const result = await confirmAction(
      `確定要停用「${d.name}」？`,
      "停用後不會出現在新訓練紀錄的選單中，歷史紀錄仍會保留。",
      "停用",
      true,
    );
    if (result.isConfirmed) deleteMut.mutate(d.id);
  };

  const filterActive = search.trim() !== "" || categoryFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">訓練項目</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            管理可在訓練紀錄中選擇的項目
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => startNew()} disabled={busy}>
            <span className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> 新增項目
            </span>
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋名稱或描述…（按 / 聚焦）"
                className="pl-8 pr-8"
                aria-label="搜尋訓練項目"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="清除搜尋"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm whitespace-nowrap select-none">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                aria-label="顯示已停用"
              />
              顯示已停用
              {totals.inactive > 0 && (
                <Chip tone="neutral" size="sm">
                  {totals.inactive}
                </Chip>
              )}
            </label>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              label="全部"
              count={totals.total}
              active={categoryFilter === "all"}
              activeClass="bg-foreground text-background"
              onClick={() => setCategoryFilter("all")}
            />
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const count = countsByCategory.get(c.value) ?? 0;
              return (
                <FilterChip
                  key={c.value}
                  label={c.label}
                  icon={Icon}
                  count={count}
                  active={categoryFilter === c.value}
                  activeClass={c.activeClass}
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter === c.value ? "all" : c.value,
                    )
                  }
                  disabled={count === 0}
                />
              );
            })}
            {filterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto h-7 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" /> 清除篩選
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main list */}
      <Card>
        <CardHeader>
          <CardTitle>
            項目清單
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {filtered.length} / {totals.total}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!isLoading && (drills?.length ?? 0) === 0 && (
              <EmptyState compact icon={Inbox} title="尚無項目" />
            )}
            {!isLoading &&
              (drills?.length ?? 0) > 0 &&
              filtered.length === 0 && (
                <EmptyState
                  compact
                  icon={Search}
                  title="沒有符合條件的項目"
                  description="試著調整搜尋字串或分類篩選"
                  action={
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      清除篩選
                    </Button>
                  }
                />
              )}
            <div className="space-y-4">
              {CATEGORIES.map((c) => {
                const items = grouped.get(c.value) ?? [];
                if (items.length === 0) return null;
                const Icon = c.icon;
                return (
                  <section key={c.value}>
                    <h2 className="flex items-center gap-2 text-sm font-semibold mb-2 border-b border-border pb-1.5">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-md",
                          c.iconBoxClass,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span>{c.label}</span>
                      <Chip tone={c.tone} size="sm">
                        {items.length}
                      </Chip>
                    </h2>
                    <ul className="space-y-1">
                      {items.map((d) => {
                        const active = editing?.id === d.id;
                        const isNewBadge = isRecentlyCreated(d.createdAt);
                        return (
                          <li
                            key={d.id}
                            className={cn(
                              "group relative flex items-center justify-between gap-2 pl-3 pr-2 py-2 rounded-md overflow-hidden transition-colors",
                              active ? "bg-accent" : "hover:bg-accent/50",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute left-0 top-0 bottom-0 w-1",
                                c.barClass,
                                active ? "opacity-100" : "opacity-50",
                              )}
                              aria-hidden
                            />
                            <button
                              type="button"
                              onClick={() => startEdit(d)}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">
                                  {d.name}
                                </span>
                                {isNewBadge && (
                                  <Chip tone="primary" size="sm">
                                    <Sparkles className="h-3 w-3" />新
                                  </Chip>
                                )}
                                {!d.isActive && (
                                  <Chip tone="neutral" size="sm">
                                    已停用
                                  </Chip>
                                )}
                              </div>
                              {d.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {d.description}
                                </p>
                              )}
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              {canUpdate && (
                                <span
                                  title={d.isActive ? "點擊停用" : "點擊啟用"}
                                  className="px-1"
                                >
                                  <Switch
                                    checked={d.isActive}
                                    onCheckedChange={(next) =>
                                      toggleActiveMut.mutate({ d, next })
                                    }
                                    disabled={busy}
                                    aria-label={
                                      d.isActive
                                        ? `停用 ${d.name}`
                                        : `啟用 ${d.name}`
                                    }
                                  />
                                </span>
                              )}
                              {canCreate && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDuplicate(d)}
                                  disabled={busy}
                                  title="複製為新項目"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                              {canUpdate && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => startEdit(d)}
                                  disabled={busy}
                                  title="編輯"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog
        open={editorOpen}
        onClose={closeEditor}
        size="lg"
        title={
          <div className="flex items-center gap-2">
            {!isNew && editing && <CategoryBadge category={editing.category} />}
            <span>{isNew ? "新增項目" : `編輯：${editing?.name}`}</span>
          </div>
        }
        description={
          !isNew && editing?.updatedAt
            ? `最後更新：${editing.updatedByName ?? "—"} 於 ${new Date(
                editing.updatedAt,
              ).toLocaleString("zh-TW", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : undefined
        }
        footer={
          <div className="flex items-center gap-2 w-full">
            {!isNew && canDelete && editing?.isActive && (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => editing && handleDelete(editing)}
                disabled={busy}
              >
                <span className="flex items-center gap-1">
                  <Trash2 className="h-4 w-4" /> 停用此項目
                </span>
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={closeEditor} disabled={busy}>
                取消
              </Button>
              {canSubmit && (
                <Button onClick={handleSave} disabled={!canSave || busy}>
                  {busy ? "儲存中…" : "儲存"}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="drillName">名稱 *</Label>
              <Input
                id="drillName"
                maxLength={64}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSave && canSubmit && !busy) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drillCategory">分類 *</Label>
              <Select
                id="drillCategory"
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}（{c.value}）
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="drillDesc">描述</Label>
            <Textarea
              id="drillDesc"
              rows={4}
              maxLength={512}
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="drillActive"
              checked={draft.isActive}
              onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
            />
            <Label htmlFor="drillActive">啟用中（取消代表停用）</Label>
          </div>
          {!canSubmit && (
            <p className="text-xs text-muted-foreground">
              你沒有{isNew ? "新增" : "修改"}項目的權限
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function FilterChip({
  label,
  icon: Icon,
  count,
  active,
  activeClass,
  onClick,
  disabled,
}: {
  label: string;
  icon?: LucideIcon;
  count: number;
  active: boolean;
  activeClass: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        active
          ? cn("border-transparent", activeClass)
          : "border-border hover:bg-accent",
      )}
      aria-pressed={active}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums rounded-full px-1.5 text-[10px]",
          active ? "bg-background/20" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_MAP.get(category);
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Chip tone={meta.tone} size="md">
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Chip>
  );
}
