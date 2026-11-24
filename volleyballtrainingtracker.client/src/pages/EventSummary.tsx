// 賽事總結頁：彙整整個賽事所有對戰的記錄單（戰績、得分來源、失誤、走勢、個人表現）
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, Loader2 } from 'lucide-react';
import { scoreSheetsApi } from '@/api/scoreSheets';
import EmptyState from '@/components/EmptyState';
import { EventSummary } from '@/components/scoresheet/EventSummary';
import { Button } from '@/components/ui/button';
import { normalizeContent } from '@/lib/scoresheet/sheet';
import type { MatchInput } from '@/lib/scoresheet/summary';
import { cn } from '@/lib/utils';

export default function EventSummaryPage() {
  const params = useParams();
  const eventId = Number(params.eventId);
  const [squad, setSquad] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['event-sheets', eventId],
    queryFn: () => scoreSheetsApi.eventSheets(eventId),
    enabled: Number.isInteger(eventId),
  });

  const matches: MatchInput[] = useMemo(
    () =>
      (q.data?.matches ?? []).map((m) => ({
        matchLogId: m.matchLogId,
        opponent: m.opponent,
        ourSquad: m.ourSquad,
        sets: m.sheets.map((s) => ({ setIndex: s.setIndex, content: normalizeContent(s.content) })),
      })),
    [q.data],
  );
  const squads = [...new Set(matches.map((m) => m.ourSquad).filter((x): x is string => x != null))].sort();
  const shown = useMemo(
    () => (squad == null ? matches : matches.filter((m) => m.ourSquad === squad)),
    [matches, squad],
  );

  if (q.isError) {
    return (
      <div className="p-4">
        <EmptyState
          title="載入失敗"
          description="無法取得賽事記錄單，請確認網路後重試"
          action={
            <Button variant="outline" className="h-11" onClick={() => void q.refetch()}>
              重試
            </Button>
          }
        />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="flex justify-center py-20" role="status" aria-label="載入中">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Link
          to="/match-logs"
          aria-label="返回比賽紀錄"
          title="返回比賽紀錄"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-lg font-semibold">{q.data.matchName || '賽事總結'}</h1>
          <div className="text-xs text-muted-foreground">{q.data.matchDate.slice(0, 10)} · 賽事總結</div>
        </div>
      </div>

      {squads.length > 1 && (
        <div role="group" aria-label="隊別" className="inline-grid grid-flow-col gap-1 rounded-lg bg-muted p-1">
          {[null, ...squads].map((s) => (
            <button
              key={s ?? 'all'}
              type="button"
              aria-pressed={squad === s}
              onClick={() => setSquad(s)}
              className={cn(
                'h-10 rounded-md px-5 text-sm font-medium',
                squad === s ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s == null ? '全部' : `${s} 隊`}
            </button>
          ))}
        </div>
      )}

      {matches.length === 0 ? (
        <EmptyState icon={BarChart3} title="尚無記錄單" description="這個賽事還沒有任何記錄單，無法產生總結" />
      ) : (
        <EventSummary matches={shown} eventId={eventId} />
      )}
    </div>
  );
}
