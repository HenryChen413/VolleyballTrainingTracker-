// 記錄單列表頁：各局清單（點入編輯）、整場合計、新增／刪除最後一局
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Loader2, Trash2 } from 'lucide-react';
import { scoreSheetsApi, type MatchScoreSheetsResponse } from '@/api/scoreSheets';
import EmptyState from '@/components/EmptyState';
import { StatGrid } from '@/components/scoresheet/StatGrid';
import { AddFab } from '@/components/ui/add-fab';
import { scoreOf } from '@/lib/scoresheet/rally';
import { normalizeContent } from '@/lib/scoresheet/sheet';
import { sumSheets } from '@/lib/scoresheet/totals';
import { clearSheetDraft } from '@/lib/scoresheet/useSheetSync';
import { confirmAction, showError } from '@/lib/swal';
import { toast } from '@/lib/toast';

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function MatchScoreSheetsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const eventId = Number(params.eventId);
  const matchLogId = Number(params.matchLogId);
  const [data, setData] = useState<MatchScoreSheetsResponse | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    return scoreSheetsApi
      .list(matchLogId)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true));
  }, [matchLogId]);

  useEffect(() => {
    if (Number.isInteger(matchLogId)) void load();
  }, [matchLogId, load]);

  const backTo = '/match-logs';

  if (error && !data) {
    return (
      <div className="p-4">
        <EmptyState title="載入失敗" description="無法取得記錄單，請稍後再試" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-20" role="status" aria-label="載入中">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const sheets = data.sheets;
  const lastIndex = sheets.length > 0 ? sheets[sheets.length - 1].setIndex : 0;
  const nextIndex = lastIndex + 1;
  const contents = sheets.map((s) => normalizeContent(s.content));
  const totals = sumSheets(contents);

  const goSheet = (i: number) => navigate(`/match-logs/${eventId}/games/${matchLogId}/sheets/${i}`);

  const onDelete = async (setIndex: number) => {
    const r = await confirmAction(`刪除第 ${setIndex} 局記錄單？已回填的局分不會改變。`, '刪除後無法復原。', '刪除', true);
    if (!r.isConfirmed) return;
    try {
      await scoreSheetsApi.remove(matchLogId, setIndex);
    } catch {
      void showError('刪除失敗', '請稍後再試');
      return;
    }
    // 一併清掉本機草稿，否則日後新增同局號會載回已刪除的內容
    clearSheetDraft(matchLogId, setIndex);
    toast.success(`已刪除第 ${setIndex} 局記錄單`);
    await load();
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Link
          to={backTo}
          aria-label="返回比賽紀錄"
          title="返回比賽紀錄"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-lg font-semibold">VS {data.opponent}</h1>
          <div className="text-xs text-muted-foreground">{data.matchDate.slice(0, 10)}</div>
        </div>
      </div>

      {sheets.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="尚無記錄單"
          description="點右下角「新增第 1 局」開始記錄"
        />
      ) : (
        <div className="space-y-4 xl:grid xl:grid-cols-[2fr_3fr] xl:gap-6 xl:items-start xl:space-y-0">
          <div className="space-y-3">
            {sheets.map((s, i) => {
              const score = scoreOf(contents[i].rally);
              const isLast = s.setIndex === lastIndex;
              return (
                <div key={s.setIndex} className="flex items-stretch gap-2 rounded-xl border bg-card">
                  <Link
                    to={`/match-logs/${eventId}/games/${matchLogId}/sheets/${s.setIndex}`}
                    className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl p-3 hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">第 {s.setIndex} 局</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.recorderName ? `記錄人 ${s.recorderName}` : '未填記錄人'} · {formatTime(s.updatedAt)}
                      </div>
                    </div>
                    <div className="shrink-0 text-2xl font-bold tabular-nums">
                      {score.our} : {score.opp}
                    </div>
                  </Link>
                  {isLast && (
                    <button
                      type="button"
                      aria-label={`刪除第 ${s.setIndex} 局記錄單`}
                      title={`刪除第 ${s.setIndex} 局記錄單`}
                      onClick={() => void onDelete(s.setIndex)}
                      className="flex w-11 shrink-0 items-center justify-center rounded-r-xl text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <section aria-label="整場合計" className="space-y-2 rounded-xl border bg-card p-3">
            <h2 className="text-sm font-semibold">整場合計</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
              {sheets.map((s, i) => {
                const sc = scoreOf(contents[i].rally);
                return (
                  <span key={s.setIndex}>
                    第 {s.setIndex} 局 {sc.our}-{sc.opp}
                  </span>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <StatGrid readOnly rows={totals.rows} oppErrors={totals.oppErrors} ourErrors={totals.ourErrors} />
            </div>
          </section>
        </div>
      )}

      <AddFab label={`新增第 ${nextIndex} 局`} onClick={() => goSheet(nextIndex)} />
    </div>
  );
}
