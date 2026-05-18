import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  Inbox,
  Search,
  X,
  Sparkles,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { drillsApi, type Drill } from "@/api/drills";
import { CATEGORIES } from "@/lib/drillCategories";
import { showError, showSuccess } from "@/lib/swal";
import { PERM, useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

const NEW_THRESHOLD_DAYS = 7;

function isRecentlyCreated(createdAt: string | undefined | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const ageMs = Date.now() - created;
  return ageMs >= 0 && ageMs <= NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}

export default function DrillsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canEdit = useAuthStore((s) => s.can(PERM.DrillsEdit));
  const canCreate = canEdit;
  const canUpdate = canEdit;

  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: drills, isLoading } = useQuery({
    queryKey: ["drills", "manage", showInactive],
    queryFn: () => drillsApi.list(!showInactive ? true : false),
  });

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
      if (categoryFilter !== "all" && d.category !== categoryFilter)
        return false;
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

  const busy = toggleActiveMut.isPending;

  const goEdit = (d: Drill) => navigate(`/drills/${d.id}`);
  const goNew = () => navigate("/drills/new");
  const goDuplicate = (d: Drill) =>
    navigate("/drills/new", {
      state: {
        preset: {
          name: `${d.name} 複本`,
          category: d.category,
          description: d.description ?? "",
          isActive: true,
        },
      },
    });

  // 鍵盤快捷鍵：N 新增、/ 聚焦搜尋（打字時不觸發）
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
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.key === "n" || e.key === "N") && canCreate) {
        e.preventDefault();
        goNew();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate]);

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
          <Button onClick={goNew} disabled={busy}>
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
                      const isNewBadge = isRecentlyCreated(d.createdAt);
                      return (
                        <li
                          key={d.id}
                          className={cn(
                            "group relative flex items-center justify-between gap-2 pl-3 pr-2 py-2 rounded-md overflow-hidden transition-colors",
                            canUpdate && "hover:bg-accent/50",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute left-0 top-0 bottom-0 w-1 opacity-50",
                              c.barClass,
                            )}
                            aria-hidden
                          />
                          {canUpdate ? (
                            <button
                              type="button"
                              onClick={() => goEdit(d)}
                              className="flex-1 text-left min-w-0"
                            >
                              <DrillRowContent
                                drill={d}
                                isNewBadge={isNewBadge}
                              />
                            </button>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <DrillRowContent
                                drill={d}
                                isNewBadge={isNewBadge}
                              />
                            </div>
                          )}
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
                                onClick={() => goDuplicate(d)}
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
                                onClick={() => goEdit(d)}
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

function DrillRowContent({
  drill: d,
  isNewBadge,
}: {
  drill: Drill;
  isNewBadge: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium truncate">{d.name}</span>
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
    </>
  );
}
