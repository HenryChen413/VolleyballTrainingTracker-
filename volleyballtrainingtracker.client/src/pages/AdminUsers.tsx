import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Mail,
  Pencil,
  Plus,
  Power,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users as UsersIcon,
  UserX,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import EmptyState from '@/components/EmptyState';
import { rolesApi, type Role } from '@/api/roles';
import {
  usersApi,
  type UserCreatePayload,
  type UserListItem,
  type UserUpdatePayload,
} from '@/api/users';
import { useAuthStore } from '@/stores/authStore';
import { confirmAction, showError, showSuccess } from '@/lib/swal';
import { cn } from '@/lib/utils';

// ── 型別 ────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'active' | 'inactive';
type ChipTone = 'neutral' | 'primary' | 'navy' | 'success' | 'destructive' | 'warning' | 'info';
type SortKey = 'user' | 'email' | 'role' | 'status';
type SortDir = 'asc' | 'desc';

interface FilterState {
  query: string;
  roleId: number | 'all';
  status: StatusFilter;
}

const emptyFilter: FilterState = { query: '', roleId: 'all', status: 'all' };

interface DraftState {
  id: number | null;
  userName: string;
  displayName: string;
  email: string;
  password: string;
  roleId: number | null;
  isActive: boolean;
  originalRoleId: number | null;
}

const emptyDraft: DraftState = {
  id: null,
  userName: '',
  displayName: '',
  email: '',
  password: '',
  roleId: null,
  isActive: true,
  originalRoleId: null,
};

// ── Role / Avatar 工具 ──────────────────────────────────────────────────
const ROLE_TONE: Record<string, ChipTone> = {
  Admin: 'warning',
  Coach: 'primary',
  Player: 'info',
};
const roleTone = (name: string): ChipTone => ROLE_TONE[name] ?? 'neutral';

const AVATAR_TONES = [
  'bg-primary/10 text-primary',
  'bg-info/10 text-info',
  'bg-success/10 text-success',
  'bg-warning/15 text-warning',
  'bg-navy/10 text-navy',
];

function avatarOf(seed: string) {
  const s = (seed || '?').trim();
  const initial = s.charAt(0).toUpperCase();
  const hash = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { initial, tone: AVATAR_TONES[hash % AVATAR_TONES.length] };
}

function Avatar({ seed, size = 'md' }: { seed: string; size?: 'sm' | 'md' }) {
  const { initial, tone } = avatarOf(seed);
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold select-none',
        size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm',
        tone,
      )}
    >
      {initial}
    </div>
  );
}

function getApiErrorMessage(e: unknown, fallback: string) {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

// ── 統計小卡 ────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'default',
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'success' | 'neutral' | 'warning';
  active?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    default: 'bg-card border-border',
    success: 'bg-success/5 border-success/20',
    neutral: 'bg-muted/30 border-border',
    warning: 'bg-warning/5 border-warning/20',
  };
  const iconTones: Record<string, string> = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    neutral: 'text-muted-foreground bg-muted',
    warning: 'text-warning bg-warning/15',
  };
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp
      onClick={onClick}
      className={cn(
        'rounded-lg border p-4 flex items-center gap-3 text-left transition',
        tones[tone],
        onClick && 'hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 cursor-pointer',
        active && 'ring-2 ring-ring',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
          iconTones[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
      </div>
    </Cmp>
  );
}

// ── 密碼強度 ────────────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[0-9]/.test(password),
    /[A-Za-z]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ['bg-destructive', 'bg-warning', 'bg-warning', 'bg-success'];
  const labels = ['很弱', '弱', '中等', '強'];
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < score ? colors[score - 1] : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {score > 0 ? `強度：${labels[score - 1]}` : '建議含英文、數字與特殊符號'}
      </p>
    </div>
  );
}

// ── 超級管理員（永久 root） ─────────────────────────────────────────────
const SUPER_ADMIN_USERNAME = 'YUANHE';
const isProtectedUser = (u: { userName: string }) =>
  u.userName.toUpperCase() === SUPER_ADMIN_USERNAME;

// ── 主元件 ──────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const canManage = me?.userName?.toUpperCase() === SUPER_ADMIN_USERNAME;

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });

  const [filters, setFilters] = useState<FilterState>(emptyFilter);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'user',
    dir: 'asc',
  });
  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [changePwd, setChangePwd] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLElement | null>>({});

  // 統計
  const stats = useMemo(() => {
    const list = users ?? [];
    const active = list.filter((u) => u.isActive).length;
    const admin = list.filter((u) => u.roleName === 'Admin').length;
    return { total: list.length, active, inactive: list.length - active, admin };
  }, [users]);

  // 篩選
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const q = filters.query.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.userName} ${u.displayName ?? ''} ${u.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.roleId !== 'all' && u.roleId !== filters.roleId) return false;
      if (filters.status === 'active' && !u.isActive) return false;
      if (filters.status === 'inactive' && u.isActive) return false;
      return true;
    });
  }, [users, filters]);

  // 排序（依使用者點擊的欄位）
  const sortedUsers = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const cmp = (a: UserListItem, b: UserListItem): number => {
      switch (sort.key) {
        case 'email':
          return (a.email ?? '').localeCompare(b.email ?? '', 'zh-Hant');
        case 'role':
          return a.roleName.localeCompare(b.roleName, 'zh-Hant');
        case 'status':
          return Number(a.isActive) - Number(b.isActive);
        case 'user':
        default:
          return (a.displayName || a.userName).localeCompare(
            b.displayName || b.userName,
            'zh-Hant',
          );
      }
    };
    return [...filteredUsers].sort((a, b) => cmp(a, b) * dir);
  }, [filteredUsers, sort]);

  // 編輯流程
  const startCreate = () => {
    setDraft({
      ...emptyDraft,
      roleId: roles?.find((r) => r.name === 'Player')?.id ?? roles?.[0]?.id ?? null,
    });
    setChangePwd(true);
    setEditorOpen(true);
  };
  const startEdit = (u: UserListItem) => {
    setDraft({
      id: u.id,
      userName: u.userName,
      displayName: u.displayName ?? '',
      email: u.email ?? '',
      password: '',
      roleId: u.roleId,
      isActive: u.isActive,
      originalRoleId: u.roleId,
    });
    setChangePwd(false);
    setEditorOpen(true);
  };
  const closeEditor = () => setEditorOpen(false);

  const flashHighlight = (id: number) => {
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
    window.setTimeout(() => {
      rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Mutations
  const createMut = useMutation({
    mutationFn: (payload: UserCreatePayload) => usersApi.create(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      showSuccess('使用者已建立');
      closeEditor();
      if (created?.id) flashHighlight(created.id);
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, '建立失敗')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserUpdatePayload }) =>
      usersApi.update(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      showSuccess('使用者已更新');
      closeEditor();
      flashHighlight(vars.id);
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, '更新失敗')),
  });

  const setActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      usersApi.setActive(id, isActive),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      showSuccess('狀態已更新');
      flashHighlight(vars.id);
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, '更新失敗')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      showSuccess('使用者已刪除');
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, '刪除失敗')),
  });

  const busy =
    createMut.isPending ||
    updateMut.isPending ||
    setActiveMut.isPending ||
    deleteMut.isPending;

  // 提交表單
  const onSubmitDraft = async () => {
    if (draft.roleId == null) {
      showError('請選擇角色');
      return;
    }

    const currentRole = roles?.find((r) => r.id === draft.roleId);
    const originalRole = roles?.find((r) => r.id === draft.originalRoleId);
    const isRoleEscalation =
      draft.id != null &&
      draft.roleId !== draft.originalRoleId &&
      (currentRole?.name === 'Admin' || originalRole?.name === 'Admin');

    if (isRoleEscalation) {
      const result = await confirmAction(
        `確定要將角色從「${originalRole?.name}」變更為「${currentRole?.name}」？`,
        'Admin 權限可進行所有系統操作，請審慎處理。',
        '確認變更',
        true,
      );
      if (!result.isConfirmed) return;
    }

    if (draft.id == null) {
      if (draft.userName.trim().length < 3) {
        showError('帳號至少 3 個字');
        return;
      }
      if (draft.password.length < 8) {
        showError('密碼至少 8 個字');
        return;
      }
      createMut.mutate({
        userName: draft.userName.toUpperCase(),
        password: draft.password,
        displayName: draft.displayName || undefined,
        email: draft.email || undefined,
        roleId: draft.roleId,
        isActive: draft.isActive,
      });
    } else {
      const payload: UserUpdatePayload = {
        displayName: draft.displayName,
        email: draft.email,
        roleId: draft.roleId,
      };
      if (changePwd && draft.password) {
        if (draft.password.length < 8) {
          showError('密碼至少 8 個字');
          return;
        }
        payload.password = draft.password;
      }
      updateMut.mutate({ id: draft.id, payload });
    }
  };

  const onToggleActive = async (u: UserListItem) => {
    const target = !u.isActive;
    const result = await confirmAction(
      `確定要${target ? '啟用' : '停用'}「${u.userName}」？`,
      '',
      target ? '啟用' : '停用',
      !target,
    );
    if (result.isConfirmed) setActiveMut.mutate({ id: u.id, isActive: target });
  };

  const onDelete = async (u: UserListItem) => {
    const result = await confirmAction(
      `確定要刪除使用者「${u.userName}」？`,
      '此操作無法復原。',
      '刪除',
      true,
    );
    if (result.isConfirmed) deleteMut.mutate(u.id);
  };

  const userNameValid =
    draft.id != null ||
    (draft.userName.trim().length >= 3 &&
      /^[A-Z0-9]+$/.test(draft.userName) &&
      draft.userName.toUpperCase() !== SUPER_ADMIN_USERNAME);
  const passwordValid =
    draft.id != null && !changePwd ? true : draft.password.length >= 8;
  const canSubmit = userNameValid && passwordValid && draft.roleId != null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">使用者管理</h1>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? '指派角色、啟用/停用帳號、新增/編輯/刪除使用者'
              : '檢視使用者清單（管理權限僅限超級管理員）'}
          </p>
          {!canManage && (
            <Chip tone="warning" size="sm">
              <Shield className="h-3 w-3" />
              僅 {SUPER_ADMIN_USERNAME} 可進行管理操作
            </Chip>
          )}
        </div>
        {canManage && (
          <Button onClick={startCreate} disabled={busy}>
            <span className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> 新增使用者
            </span>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="總計"
          value={stats.total}
          icon={UsersIcon}
          active={filters.status === 'all' && filters.roleId === 'all'}
          onClick={() =>
            setFilters((f) => ({ ...f, status: 'all', roleId: 'all' }))
          }
        />
        <StatTile
          label="啟用"
          value={stats.active}
          icon={UserCog}
          tone="success"
          active={filters.status === 'active'}
          onClick={() => setFilters((f) => ({ ...f, status: 'active' }))}
        />
        <StatTile
          label="停用"
          value={stats.inactive}
          icon={UserX}
          tone="neutral"
          active={filters.status === 'inactive'}
          onClick={() => setFilters((f) => ({ ...f, status: 'inactive' }))}
        />
        <StatTile label="Admin" value={stats.admin} icon={Shield} tone="warning" />
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6 space-y-1">
              <Label htmlFor="f-query">搜尋</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="f-query"
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  placeholder="帳號 / 顯示名稱 / Email"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label htmlFor="f-roleId">角色</Label>
              <Select
                id="f-roleId"
                value={filters.roleId}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    roleId: e.target.value === 'all' ? 'all' : Number(e.target.value),
                  }))
                }
              >
                <option value="all">全部角色</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label>狀態</Label>
              <div className="inline-flex h-10 w-full rounded-md border bg-muted/40 p-0.5">
                {(['all', 'active', 'inactive'] as const).map((s) => {
                  const label = s === 'all' ? '全部' : s === 'active' ? '啟用' : '停用';
                  const isActive = filters.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, status: s }))}
                      className={cn(
                        'flex-1 text-sm rounded-sm transition',
                        isActive
                          ? 'bg-background shadow-sm font-medium'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && filteredUsers.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={UsersIcon}
              title={
                users && users.length > 0 ? '無符合條件的使用者' : '尚無使用者'
              }
              description={
                users && users.length > 0 ? '可調整篩選條件或清除目前的條件' : undefined
              }
              action={
                users && users.length > 0 ? (
                  <Button variant="outline" onClick={() => setFilters(emptyFilter)}>
                    清除篩選
                  </Button>
                ) : canManage ? (
                  <Button onClick={startCreate}>
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-4 w-4" /> 新增使用者
                    </span>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {/* List */}
      {!isLoading && filteredUsers.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur text-left">
                  <tr className="border-b">
                    <SortableTh label="使用者" sortKey="user" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Email" sortKey="email" sort={sort} onSort={toggleSort} />
                    <SortableTh label="角色" sortKey="role" sort={sort} onSort={toggleSort} />
                    <SortableTh label="狀態" sortKey="status" sort={sort} onSort={toggleSort} />
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      isSelf={me?.id === u.id}
                      canManage={canManage}
                      busy={busy}
                      highlight={highlightId === u.id}
                      rowRef={(el) => (rowRefs.current[u.id] = el)}
                      onEdit={() => canManage && startEdit(u)}
                      onToggleActive={() => onToggleActive(u)}
                      onDelete={() => onDelete(u)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {sortedUsers.map((u) => (
              <UserMobileCard
                key={u.id}
                user={u}
                isSelf={me?.id === u.id}
                canManage={canManage}
                busy={busy}
                highlight={highlightId === u.id}
                onEdit={() => canManage && startEdit(u)}
                onToggleActive={() => onToggleActive(u)}
                onDelete={() => onDelete(u)}
              />
            ))}
          </div>
        </>
      )}

      {/* Editor Dialog */}
      <Dialog
        open={editorOpen && canManage}
        onClose={closeEditor}
        size="lg"
        closeOnBackdrop={false}
        title={draft.id == null ? '新增使用者' : `編輯：${draft.userName}`}
        description={
          draft.id == null
            ? '建立新的系統使用者帳號'
            : '修改使用者資料、角色或密碼'
        }
        footer={
          <>
            <Button variant="outline" onClick={closeEditor} disabled={busy}>
              取消
            </Button>
            <Button onClick={onSubmitDraft} disabled={busy || !canSubmit}>
              {busy ? '儲存中…' : '儲存'}
            </Button>
          </>
        }
      >
        <EditorForm
          draft={draft}
          setDraft={setDraft}
          roles={roles}
          busy={busy}
          changePwd={changePwd}
          setChangePwd={setChangePwd}
        />
      </Dialog>
    </div>
  );
}

// ── 子元件：可排序表頭 ──────────────────────────────────────────────────
function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-4 py-3 font-medium text-muted-foreground">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
        aria-label={`依${label}排序`}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

// ── 子元件：桌機列 ──────────────────────────────────────────────────────
interface RowProps {
  user: UserListItem;
  isSelf: boolean;
  canManage: boolean;
  busy: boolean;
  highlight: boolean;
  rowRef?: (el: HTMLTableRowElement | null) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function UserRow({
  user: u,
  isSelf,
  canManage,
  busy,
  highlight,
  rowRef,
  onEdit,
  onToggleActive,
  onDelete,
}: RowProps) {
  return (
    <tr
      ref={rowRef}
      className={cn(
        'border-b last:border-0 transition-colors',
        canManage ? 'cursor-pointer hover:bg-muted/40' : '',
        highlight && 'bg-success/10',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (canManage) onEdit();
      }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar seed={u.displayName || u.userName} />
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-1.5 flex-wrap">
              <span className="truncate">{u.displayName || u.userName}</span>
              {isSelf && (
                <Chip tone="primary" size="sm">
                  我
                </Chip>
              )}
              {isProtectedUser(u) && (
                <Chip tone="warning" size="sm" title="超級管理員，不可停用或刪除">
                  <Shield className="h-3 w-3" />
                  超管
                </Chip>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">@{u.userName}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {u.email ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{u.email}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Chip tone={roleTone(u.roleName)}>{u.roleName}</Chip>
      </td>
      <td className="px-4 py-3">
        {u.isActive ? (
          <Chip tone="success">啟用</Chip>
        ) : (
          <Chip tone="neutral">停用</Chip>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {canManage ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                disabled={busy}
                onClick={onEdit}
                title="編輯"
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={isProtectedUser(u) || (isSelf && u.isActive) || busy}
                onClick={onToggleActive}
                title={
                  isProtectedUser(u)
                    ? '超級管理員不可停用'
                    : u.isActive
                      ? '停用'
                      : '啟用'
                }
                className="h-8 w-8"
              >
                <Power className={cn('h-4 w-4', u.isActive ? 'text-muted-foreground' : 'text-success')} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={isProtectedUser(u) || isSelf || busy}
                onClick={onDelete}
                title={isProtectedUser(u) ? '超級管理員不可刪除' : '刪除'}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">僅供檢視</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── 子元件：手機卡片 ───────────────────────────────────────────────────
function UserMobileCard({
  user: u,
  isSelf,
  canManage,
  busy,
  highlight,
  onEdit,
  onToggleActive,
  onDelete,
}: Omit<RowProps, 'rowRef'>) {
  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        canManage && 'cursor-pointer active:bg-muted/30',
        highlight && 'ring-2 ring-success',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (canManage) onEdit();
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar seed={u.displayName || u.userName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium truncate">{u.displayName || u.userName}</span>
            {isSelf && (
              <Chip tone="primary" size="sm">
                我
              </Chip>
            )}
            {isProtectedUser(u) && (
              <Chip tone="warning" size="sm" title="超級管理員，不可停用或刪除">
                <Shield className="h-3 w-3" />
                超管
              </Chip>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">@{u.userName}</div>
          {u.email && (
            <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              <Mail className="h-3 w-3 shrink-0" />
              {u.email}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <Chip tone={roleTone(u.roleName)} size="sm">
              {u.roleName}
            </Chip>
            {u.isActive ? (
              <Chip tone="success" size="sm">
                啟用
              </Chip>
            ) : (
              <Chip tone="neutral" size="sm">
                停用
              </Chip>
            )}
          </div>
        </div>
      </div>
      {canManage && (
        <div className="flex items-center gap-1 justify-end mt-3 pt-3 border-t">
          <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
            <span className="flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5" /> 編輯
            </span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isProtectedUser(u) || (isSelf && u.isActive) || busy}
            onClick={onToggleActive}
            title={isProtectedUser(u) ? '超級管理員不可停用' : undefined}
          >
            <span className="flex items-center gap-1">
              <Power className="h-3.5 w-3.5" />
              {u.isActive ? '停用' : '啟用'}
            </span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isProtectedUser(u) || isSelf || busy}
            onClick={onDelete}
            className="text-destructive"
            title={isProtectedUser(u) ? '超級管理員不可刪除' : undefined}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── 子元件：編輯表單 ───────────────────────────────────────────────────
interface EditorFormProps {
  draft: DraftState;
  setDraft: React.Dispatch<React.SetStateAction<DraftState>>;
  roles: Role[] | undefined;
  /** 有 mutation 進行中：鎖定整個表單 */
  busy: boolean;
  changePwd: boolean;
  setChangePwd: React.Dispatch<React.SetStateAction<boolean>>;
}

function EditorForm({
  draft,
  setDraft,
  roles,
  busy,
  changePwd,
  setChangePwd,
}: EditorFormProps) {
  const isEdit = draft.id != null;
  const roleChanged = isEdit && draft.roleId !== draft.originalRoleId;
  const currentRole = roles?.find((r) => r.id === draft.roleId);
  const editingSuperAdmin = isEdit && isProtectedUser({ userName: draft.userName });

  // userName 驗證提示
  const userNameTooShort = !isEdit && draft.userName.length > 0 && draft.userName.length < 3;
  // 防止建立保留帳號
  const userNameReserved =
    !isEdit && draft.userName.toUpperCase() === SUPER_ADMIN_USERNAME;

  return (
    // 儲存進行中時鎖定整個編輯表單
    <fieldset disabled={busy} className="space-y-5 min-w-0 border-0 p-0 m-0">
      {editingSuperAdmin && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
          <Shield className="h-4 w-4 mt-0.5 text-warning shrink-0" />
          <div>
            <div className="font-medium">超級管理員帳號</div>
            <p className="text-xs text-muted-foreground">
              角色與啟用狀態不可變更，且此帳號永遠不可被停用或刪除。
            </p>
          </div>
        </div>
      )}

      {/* 區塊 1：基本資料 */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          基本資料
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="d-userName">
              帳號 {!isEdit && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="d-userName"
              value={draft.userName}
              disabled={isEdit}
              style={{ textTransform: 'uppercase' }}
              maxLength={32}
              onChange={(e) => {
                const upper = e.target.value.replace(/[^A-Z0-9]/gi, (c) =>
                  /[a-z]/.test(c) ? c.toUpperCase() : '',
                );
                setDraft((d) => ({ ...d, userName: upper }));
              }}
              placeholder="僅英數，3 字以上"
            />
            {userNameTooShort && (
              <p className="text-xs text-destructive">至少 3 個字</p>
            )}
            {userNameReserved && (
              <p className="text-xs text-destructive">
                {SUPER_ADMIN_USERNAME} 為保留帳號，無法使用
              </p>
            )}
            {isEdit && (
              <p className="text-xs text-muted-foreground">帳號建立後不可變更</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-displayName">顯示名稱</Label>
            <Input
              id="d-displayName"
              value={draft.displayName}
              maxLength={64}
              onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
              placeholder="例：王小明"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="d-email">Email</Label>
            <Input
              id="d-email"
              type="email"
              value={draft.email}
              maxLength={128}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              placeholder="example@domain.com"
            />
          </div>
        </div>
      </section>

      {/* 區塊 2：帳號設定 */}
      <section className="space-y-3 pt-4 border-t">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          帳號設定
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="d-roleId">
              角色 <span className="text-destructive">*</span>
            </Label>
            <Select
              id="d-roleId"
              value={draft.roleId ?? ''}
              disabled={editingSuperAdmin}
              onChange={(e) => setDraft((d) => ({ ...d, roleId: Number(e.target.value) }))}
            >
              <option value="" disabled>
                請選擇
              </option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2 min-h-[1.25rem]">
              {currentRole && (
                <Chip tone={roleTone(currentRole.name)} size="sm">
                  {currentRole.name}
                </Chip>
              )}
              {roleChanged && (
                <Chip tone="warning" size="sm">
                  權限變更
                </Chip>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>啟用狀態 {isEdit && <span className="text-xs text-muted-foreground">（請至清單使用啟用/停用按鈕）</span>}</Label>
            <div className="flex h-10 items-center gap-3">
              <Switch
                id="d-isActive"
                checked={draft.isActive}
                disabled={isEdit}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: v }))}
                aria-label="啟用狀態"
              />
              <span className="text-sm text-muted-foreground">
                {draft.isActive ? '帳號啟用中' : '帳號已停用，無法登入'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 區塊 3：密碼 */}
      <section className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            密碼
          </h3>
          {isEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setChangePwd((v) => !v);
                setDraft((d) => ({ ...d, password: '' }));
              }}
            >
              {changePwd ? '取消變更' : '變更密碼'}
            </Button>
          )}
        </div>

        {(!isEdit || changePwd) && (
          <div className="space-y-1.5">
            <Label htmlFor="d-password">
              {isEdit ? '新密碼' : '密碼'} <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="d-password"
              value={draft.password}
              onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              placeholder="至少 6 個字"
              autoComplete="new-password"
            />
            <PasswordStrength password={draft.password} />
          </div>
        )}

        {isEdit && !changePwd && (
          <p className="text-xs text-muted-foreground">點「變更密碼」可重設此使用者密碼</p>
        )}
      </section>
    </fieldset>
  );
}
