import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, Pencil, Volleyball, MapPin, Clock, Search } from 'lucide-react';
import { sessionsApi, type SessionDrill, type SessionListItem } from '@/api/sessions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Chip } from '@/components/ui/chip';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { PERM, useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  Basic: '基礎',
  Serve: '發球',
  Pass: '接發球',
  Set: '舉球',
  Attack: '攻擊',
  Block: '攔網',
  Dig: '防守',
  Fitness: '體能',
};

const CATEGORY_ORDER = ['Basic', 'Serve', 'Pass', 'Set', 'Attack', 'Block', 'Dig', 'Fitness'];

type ChipTone =
  | 'neutral' | 'primary' | 'navy' | 'success'
  | 'destructive' | 'warning' | 'info' | 'outline';

const CATEGORY_TONE: Record<string, ChipTone> = {
  Basic: 'neutral',
  Serve: 'info',
  Pass: 'success',
  Set: 'primary',
  Attack: 'destructive',
  Block: 'warning',
  Dig: 'navy',
  Fitness: 'outline',
};

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function groupByCategory(drills: SessionDrill[]): { category: string; items: SessionDrill[] }[] {
  const map = new Map<string, SessionDrill[]>();
  for (const d of drills) {
    const arr = map.get(d.category) ?? [];
    arr.push(d);
    map.set(d.category, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    })
    .map(([category, items]) => ({ category, items }));
}

function SessionCard({
  session,
  expanded,
  onToggle,
  canEdit,
}: {
  session: SessionListItem;
  expanded: boolean;
  onToggle: (id: number) => void;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['sessions', String(session.id)],
    queryFn: () => sessionsApi.get(session.id),
  });

  const drills = data?.drills ?? [];
  const groups = useMemo(() => groupByCategory(drills), [drills]);

  const d = new Date(`${session.sessionDate.slice(0, 10)}T00:00:00`);
  const day = d.getDate();
  const monthLabel = `${d.getMonth() + 1} 月`;
  const weekday = WEEKDAYS[d.getDay()];

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-lift',
        expanded && 'ring-1 ring-primary/30',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(session.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(session.id);
          }
        }}
        className="flex w-full cursor-pointer items-stretch gap-4 p-4 text-left"
      >
        {/* 日期徽章 */}
        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 py-2 text-primary">
          <span className="font-numeric text-2xl font-bold leading-none">{day}</span>
          <span className="mt-1 text-[11px]">{monthLabel}</span>
          <span className="text-[10px] text-primary/70">{weekday}</span>
        </div>

        {/* 內容 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {session.location ? (
                  <>
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{session.location}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">未指定地點</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {session.startTime && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="font-numeric">{session.startTime}</span>
                  </span>
                )}
                <span>{isLoading ? '載入中…' : `${drills.length} 個訓練項目`}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/sessions/${session.id}`);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  expanded && 'rotate-180',
                )}
              />
            </div>
          </div>

          {/* 分類預覽 */}
          {!isLoading && groups.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <Chip key={g.category} tone={CATEGORY_TONE[g.category] ?? 'neutral'} size="sm">
                  {CATEGORY_LABELS[g.category] ?? g.category}
                  <span className="font-numeric font-semibold">{g.items.length}</span>
                </Chip>
              ))}
            </div>
          )}
          {!isLoading && drills.length === 0 && (
            <p className="mt-2.5 text-xs text-muted-foreground">尚未選取訓練項目</p>
          )}

          {/* 備註 */}
          {session.notes && (
            <p className={cn('mt-2 text-xs text-muted-foreground', !expanded && 'truncate')}>
              {session.notes}
            </p>
          )}
        </div>
      </div>

      {/* 展開：訓練項目分類 */}
      {expanded && (
        <div className="animate-slide-up border-t bg-muted/30 p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : drills.length === 0 ? (
            <EmptyState compact title="尚未選取訓練項目" icon={Volleyball} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groups.map((g) => (
                <Card key={g.category} className="bg-card shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{CATEGORY_LABELS[g.category] ?? g.category}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {g.items.length} 項
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {g.items.map((dr) => (
                        <li key={dr.drillId} className="text-sm leading-snug">
                          {dr.drillName}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function SessionsPage() {
  const navigate = useNavigate();
  const canEdit = useAuthStore((s) => s.can(PERM.SessionsEdit));
  const { data, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
  });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const locations = useMemo(
    () =>
      Array.from(
        new Set((data ?? []).map((s) => s.location).filter((l): l is string => !!l)),
      ).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      if (locationFilter && s.location !== locationFilter) return false;
      if (kw) {
        const hay = `${s.location ?? ''} ${s.notes ?? ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [data, search, locationFilter]);

  const hasData = (data?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            訓練紀錄
            {!isLoading && (
              <Chip tone="navy" className="font-numeric">{data?.length ?? 0}</Chip>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            點擊卡片可展開查看訓練項目分類
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate('/sessions/new')}>
            <Plus className="mr-1 h-4 w-4" /> 新增訓練
          </Button>
        )}
      </div>

      {!isLoading && hasData && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜尋地點或備註…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {locations.length > 0 && (
            <Select
              className="sm:w-48"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">所有地點</option>
              {locations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : !hasData ? (
        <Card>
          <EmptyState
            icon={Volleyball}
            title="尚無訓練紀錄"
            description={canEdit ? '點擊「新增訓練」開始第一筆紀錄' : undefined}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="沒有符合條件的訓練" compact />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              expanded={expanded.has(s.id)}
              onToggle={toggle}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
