import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, CloudOff, Loader2, Undo2, XCircle } from 'lucide-react';
import {
  scoreSheetsApi,
  type MatchScoreSheetDto,
  type MatchScoreSheetsResponse,
  type SheetRosterPlayer,
} from '@/api/scoreSheets';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LineupGrid } from '@/components/scoresheet/LineupGrid';
import { RallyStrip } from '@/components/scoresheet/RallyStrip';
import { RotateHint } from '@/components/scoresheet/RotateHint';
import { StatGrid } from '@/components/scoresheet/StatGrid';
import { SubDialog } from '@/components/scoresheet/SubDialog';
import type { StatKey } from '@/lib/scoresheet/columns';
import { MAX_SET_INDEX, openSheetOffline, readListCache, writeListCache } from '@/lib/scoresheet/listCache';
import { scoreOf } from '@/lib/scoresheet/rally';
import {
  addRow,
  bumpErrors,
  bumpStat,
  popRally,
  pushRally,
  removeRow,
  addSub,
  removeSub,
  setLibero,
  subMarks,
  setLineup,
  type RallyItem,
  type SheetContent,
} from '@/lib/scoresheet/sheet';
import { readSheetDraft, useSheetSync, type SyncStatus } from '@/lib/scoresheet/useSheetSync';
import { confirmAction, showError } from '@/lib/swal';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

/** 表格撤銷堆疊上限 */
const UNDO_LIMIT = 200;
/** 載入超過此毫秒數仍未完成，且有快取或本機草稿時，提供離線繼續 */
const SLOW_LOAD_MS = 8000;

/** 觸控按鈕：避免長按選字／系統選單、取消雙擊縮放延遲 */
const TOUCH = 'select-none touch-manipulation [-webkit-touch-callout:none]';

/** 填寫期間保持螢幕常亮；不支援就略過，回到前景時重新取得 */
function useWakeLock() {
  useEffect(() => {
    const wl = typeof navigator !== 'undefined' && 'wakeLock' in navigator ? navigator.wakeLock : undefined;
    if (!wl) return;
    let sentinel: WakeLockSentinel | null = null;
    let requesting = false;
    let disposed = false;
    const acquire = () => {
      // 已持有（且未被系統釋放）或請求進行中就不再重複取得，避免卸載後仍有殘留的鎖
      if (document.visibilityState !== 'visible' || requesting) return;
      if (sentinel && !sentinel.released) return;
      requesting = true;
      wl.request('screen')
        .then((s) => {
          requesting = false;
          if (disposed) {
            void s.release().catch(() => {});
            return;
          }
          if (sentinel && sentinel !== s) void sentinel.release().catch(() => {});
          sentinel = s;
        })
        .catch(() => {
          requesting = false;
          /* 省電模式等情況會被拒絕，忽略 */
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

/** 只還原表格部分（各列次數、雙方失誤），不動比分發展、站位與列的增減 */
function restoreTable(c: SheetContent, prev: SheetContent): SheetContent {
  return {
    ...c,
    oppErrors: prev.oppErrors,
    ourErrors: prev.ourErrors,
    rows: c.rows.map((r) => {
      const p = prev.rows.find((x) => x.playerId === r.playerId);
      return p ? { ...r, counts: p.counts } : r;
    }),
  };
}

const STATUS_VIEW: Record<SyncStatus, { label: string; className: string; icon: typeof Check }> = {
  saved: { label: '已同步', className: 'text-success', icon: Check },
  pending: { label: '同步中', className: 'text-muted-foreground', icon: Loader2 },
  saving: { label: '同步中', className: 'text-muted-foreground', icon: Loader2 },
  offline: { label: '離線，稍後重送', className: 'text-warning', icon: CloudOff },
  error: { label: '無法同步', className: 'text-destructive', icon: XCircle },
  conflict: { label: '版本衝突', className: 'text-destructive', icon: AlertTriangle },
};

function SyncBadge({ status, errorMessage }: { status: SyncStatus; errorMessage: string | null }) {
  const v = STATUS_VIEW[status];
  const Icon = v.icon;
  const label = status === 'error' && errorMessage ? `無法同步（${errorMessage}）` : v.label;
  return (
    <span
      role="status"
      aria-label="同步狀態"
      className={cn('flex min-w-0 items-center gap-1 text-xs', status === 'error' ? 'truncate' : 'whitespace-nowrap', v.className)}
      title={label}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', status === 'saving' && 'animate-spin')} aria-hidden />
      {label}
    </span>
  );
}

interface EditorProps {
  data: MatchScoreSheetsResponse;
  setIndex: number;
  server: MatchScoreSheetDto | null;
  listPath: string;
}

/** 單局記錄單本體；useSheetSync 只在掛載時讀 server，呼叫端以 key 區分各局 */
function SheetEditor({ data, setIndex, server, listPath }: EditorProps) {
  const sync = useSheetSync({ matchLogId: data.matchLogId, setIndex, server });
  const { content, update, setRecorderName, conflict, resolveConflict } = sync;
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  // 新局首次載入時預填記錄人；等到第一次實際編輯才寫入，避免只是打開頁面就在伺服器建立空白局
  const [pendingRecorder, setPendingRecorder] = useState<string | null>(() =>
    server === null && sync.recorderName === null ? (user?.displayName || user?.userName || null) : null,
  );

  const undoRef = useRef<SheetContent[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [lineupOpen, setLineupOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [resolvingFor, setResolvingFor] = useState<object | null>(null);

  useWakeLock();

  const edit = (fn: (c: SheetContent) => SheetContent) => {
    if (pendingRecorder !== null) {
      setRecorderName(pendingRecorder);
      setPendingRecorder(null);
    }
    update(fn);
  };

  const pushUndo = (snap: SheetContent) => {
    const stack = undoRef.current;
    stack.push(snap);
    if (stack.length > UNDO_LIMIT) stack.shift();
    setUndoCount(stack.length);
  };

  const onBump = (playerId: number, key: StatKey, delta: 1 | -1) => {
    const cur = content.rows.find((r) => r.playerId === playerId)?.counts[key] ?? 0;
    if (delta === -1 && cur === 0) return; // 已是 0，不留無效的撤銷紀錄
    edit((c) => {
      pushUndo(c);
      return bumpStat(c, playerId, key, delta);
    });
  };

  const onBumpErrors = (side: 'opp' | 'our', delta: 1 | -1) => {
    const cur = side === 'opp' ? content.oppErrors : content.ourErrors;
    if (delta === -1 && cur === 0) return;
    edit((c) => {
      pushUndo(c);
      return bumpErrors(c, side, delta);
    });
  };

  const undoTable = () => {
    const prev = undoRef.current.pop();
    setUndoCount(undoRef.current.length);
    if (prev) edit((c) => restoreTable(c, prev));
  };

  const onRemoveRow = async (playerId: number) => {
    const row = content.rows.find((r) => r.playerId === playerId);
    if (!row) return;
    const hasData = Object.values(row.counts).some((n) => (n ?? 0) > 0);
    if (hasData) {
      const res = await confirmAction('移除隊員', `${row.name} 已有劃記，確定要移除？`, '移除', true);
      if (!res.isConfirmed) return;
    }
    edit((c) => removeRow(c, playerId));
  };

  const addPlayer = (p: SheetRosterPlayer) =>
    edit((c) => addRow(c, { playerId: p.playerId, name: p.name, jerseyNo: p.jerseyNo }));

  const onSub = (out: number, p: { playerId: number; name: string; jerseyNo: number | null }) =>
    edit((c) => addSub(addRow(c, p), out, p.playerId));
  const onRemoveSub = (index: number) => edit((c) => removeSub(c, index));
  const labelOf = (id: number) => {
    const r = content.rows.find((x) => x.playerId === id);
    return r ? (r.jerseyNo != null ? String(r.jerseyNo) : r.name) : '?';
  };

  const rally = (item: RallyItem) => edit((c) => pushRally(c, item));
  const undoRally = () => {
    if (content.rally.length > 0) edit(popRally);
  };

  const onLineup = (slot: number, playerId: number | null) => edit((c) => setLineup(c, slot, playerId));
  const onLibero = (slot: number, playerId: number | null) => edit((c) => setLibero(c, slot, playerId));

  const onResolve = (choice: 'mine' | 'server' | 'discard') => {
    if (!conflict) return;
    setResolvingFor(conflict);
    void resolveConflict(choice).then((ok) => {
      if (ok && choice === 'discard') {
        // 伺服器上此局已被刪除且捨棄本機版本：回到列表
        navigate(listPath, { replace: true });
        return;
      }
      if (!ok) {
        // 取不到伺服器版本：重新啟用按鈕讓使用者再試
        setResolvingFor(null);
        showError('無法取得伺服器版本，請檢查網路後再試');
        return;
      }
      // 改用伺服器版本後，畫面上的撤銷紀錄已不對應目前內容
      if (choice === 'server') {
        undoRef.current = [];
        setUndoCount(0);
      }
    });
  };
  const resolving = conflict !== null && resolvingFor === conflict;
  /** 伺服器上此局已被刪除（衝突版本為 0） */
  const deletedOnServer = conflict?.version === 0;

  const score = scoreOf(content.rally);
  const added = new Set(content.rows.map((r) => r.playerId));
  const available = data.roster.filter((p) => !added.has(p.playerId));
  const recorderValue = sync.recorderName ?? pendingRecorder ?? '';

  const lineupProps = {
    lineup: content.lineup,
    liberos: content.liberos,
    rows: content.rows,
    onChange: onLineup,
    onLiberoChange: onLibero,
  };

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
      <RotateHint backTo={listPath} />

      {/* 頁首 */}
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-2 py-1.5 lg:gap-4 lg:px-4">
        <Link
          to={listPath}
          aria-label="返回記錄單列表"
          title="返回記錄單列表"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 leading-tight">
          <div className="truncate font-semibold">VS {data.opponent}</div>
          <div className="text-xs text-muted-foreground">第 {setIndex} 局</div>
        </div>
        <output aria-label="目前比分" className="shrink-0 px-1 text-2xl font-bold tabular-nums lg:text-4xl">
          {score.our} : {score.opp}
        </output>
        <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          紀錄
          <Input
            aria-label="記錄人"
            value={recorderValue}
            maxLength={64}
            onChange={(e) => {
              setPendingRecorder(null);
              setRecorderName(e.target.value === '' ? null : e.target.value);
            }}
            className="h-11 w-24 px-2 text-sm text-foreground lg:w-32"
          />
        </label>
        <SyncBadge status={sync.status} errorMessage={sync.errorMessage} />
        {sync.status === 'error' && (
          <Button variant="outline" aria-label="重試同步" className={cn(TOUCH, 'h-11 shrink-0')} onClick={sync.retry}>
            重試
          </Button>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden xl:block"><LineupGrid {...lineupProps} /></div>
          <Button variant="outline" className={cn(TOUCH, 'h-11 xl:hidden')} onClick={() => setLineupOpen(true)}>
            站位
          </Button>
          <Button variant="outline" className={cn(TOUCH, 'h-11')} onClick={() => setAddOpen(true)}>
            ＋隊員
          </Button>
        </div>
      </header>

      {/* 球員表格：可上下左右捲動 */}
      <main className="min-h-0 flex-1 space-y-2 overflow-auto overscroll-contain p-2 lg:p-4">
        <StatGrid
          rows={content.rows}
          oppErrors={content.oppErrors}
          ourErrors={content.ourErrors}
          onBump={onBump}
          onBumpErrors={onBumpErrors}
          onRemoveRow={(id) => void onRemoveRow(id)}
          marks={subMarks(content)}
        />
        <div className="flex justify-end">
          <Button variant="ghost" className={cn(TOUCH, 'h-11')} onClick={undoTable} disabled={undoCount === 0}>
            <Undo2 className="mr-1 h-4 w-4" aria-hidden />
            撤銷表格
          </Button>
        </div>
      </main>

      {/* 比分發展：固定在底部 */}
      <footer className="shrink-0 space-y-2 border-t bg-card px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:px-4">
        <RallyStrip rally={content.rally} subs={content.subs} labelOf={labelOf} />
        <div className="flex flex-wrap items-center gap-2">
          <Button className={cn(TOUCH, 'h-12 px-6 text-base')} onClick={() => rally('U')}>
            我方 +1
          </Button>
          <Button
            variant="outline"
            className={cn(TOUCH, 'h-12 border-destructive px-6 text-base text-destructive')}
            onClick={() => rally('O')}
          >
            對方 +1
          </Button>
          <Button variant="outline" className={cn(TOUCH, 'h-11')} onClick={() => rally('TU')}>
            我方暫停
          </Button>
          <Button variant="outline" className={cn(TOUCH, 'h-11')} onClick={() => rally('TO')}>
            對方暫停
          </Button>
          <Button variant="outline" className={cn(TOUCH, 'h-11')} onClick={() => setSubOpen(true)}>
            換人
          </Button>
          <Button
            variant="ghost"
            className={cn(TOUCH, 'ml-auto h-11')}
            onClick={undoRally}
            disabled={content.rally.length === 0}
          >
            <Undo2 className="mr-1 h-4 w-4" aria-hidden />
            撤銷比分
          </Button>
        </div>
      </footer>

      <Dialog open={lineupOpen} onClose={() => setLineupOpen(false)} title="第一球站位" size="sm">
        <div className="flex justify-center"><LineupGrid {...lineupProps} layout="stacked" /></div>
        {content.rows.length === 0 && (
          <p className="mt-3 text-center text-sm text-muted-foreground">請先加入隊員</p>
        )}
      </Dialog>

      <SubDialog
        open={subOpen}
        onClose={() => setSubOpen(false)}
        content={content}
        roster={data.roster}
        onSubmit={onSub}
        onRemove={onRemoveSub}
      />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="加入隊員">
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {data.roster.length === 0 ? '此賽事沒有可加入的球員' : '名單中的球員都已加入'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {available.map((p) => (
              <Button
                key={p.playerId}
                variant="outline"
                className={cn(TOUCH, 'h-11 justify-start')}
                onClick={() => addPlayer(p)}
              >
                {p.jerseyNo != null && <span className="mr-1 text-muted-foreground tabular-nums">{p.jerseyNo}</span>}
                {p.name}
              </Button>
            ))}
          </div>
        )}
      </Dialog>

      {/* 版本衝突：強制選擇，期間無法編輯 */}
      <Dialog
        open={conflict !== null}
        onClose={() => {}}
        closeOnBackdrop={false}
        hideClose
        title="版本衝突"
        size="sm"
        footer={
          deletedOnServer ? (
            <>
              <Button variant="outline" className="h-11" disabled={resolving} onClick={() => onResolve('discard')}>
                捨棄本機版本
              </Button>
              <Button className="h-11" disabled={resolving} onClick={() => onResolve('mine')}>
                用我的重新建立
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="h-11" disabled={resolving} onClick={() => onResolve('server')}>
                改用伺服器版本
              </Button>
              <Button className="h-11" disabled={resolving} onClick={() => onResolve('mine')}>
                用我的覆蓋
              </Button>
            </>
          )
        }
      >
        <p className="text-sm">
          {deletedOnServer ? '伺服器上此局已被刪除' : `伺服器上有較新的版本（${conflict?.updatedByName ?? '未知'}）`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">本機的修改已暫存，選擇後才會繼續同步。</p>
      </Dialog>
    </div>,
    document.body,
  );
}

/** 單局比賽記錄單（填寫／回看同一頁） */
export default function MatchScoreSheetPage() {
  const params = useParams();
  const matchLogId = Number(params.matchLogId);
  const setIndex = Number(params.setIndex);
  const listPath = `/match-logs/${params.eventId}/games/${params.matchLogId}/sheets`;

  const [tick, setTick] = useState(0);
  const loadKey = `${matchLogId}:${setIndex}:${tick}`;
  const sheetKey = `${matchLogId}:${setIndex}`;
  const [state, setState] = useState<{ key: string; data?: MatchScoreSheetsResponse; error?: boolean } | null>(null);
  /** 載入超過 SLOW_LOAD_MS 的 loadKey（Render 冷啟動或網路不穩） */
  const [slowKey, setSlowKey] = useState<string | null>(null);
  /** 使用者選擇離線繼續（以快取／本機草稿開啟）的局 */
  const [draftKey, setDraftKey] = useState<string | null>(null);

  // 每次進入都重新取得（不用快取），避免以舊版本號上傳造成假衝突
  useEffect(() => {
    if (!Number.isInteger(matchLogId) || matchLogId <= 0) return;
    let alive = true;
    const slowTimer = setTimeout(() => {
      if (alive) setSlowKey(loadKey);
    }, SLOW_LOAD_MS);
    scoreSheetsApi
      .list(matchLogId)
      .then((data) => {
        // 保存最後一次成功取得的資料，供離線時使用（對手、名單、各局）
        writeListCache(data);
        if (alive) setState({ key: loadKey, data });
      })
      .catch(() => {
        if (alive) setState({ key: loadKey, error: true });
      })
      .finally(() => clearTimeout(slowTimer));
    return () => {
      alive = false;
      clearTimeout(slowTimer);
    };
  }, [matchLogId, loadKey]);

  if (!Number.isInteger(matchLogId) || matchLogId <= 0) return <Navigate to="/match-logs" replace />;

  const loaded = state?.key === loadKey ? state : null;
  const okData = loaded?.data && !loaded.error ? loaded.data : null;

  // 離線模式：以快取的對手、名單、各局（及本機草稿）開啟；可開啟已有的局、只有本機草稿的局或下一局
  if (draftKey === sheetKey) {
    const off = openSheetOffline(matchLogId, setIndex, okData);
    if (!off.valid) return <Navigate to={listPath} replace />;
    return <SheetEditor key={sheetKey} data={off.data} setIndex={setIndex} server={off.server} listPath={listPath} />;
  }

  const failed = loaded !== null && !okData;
  const hasDraft = Number.isInteger(setIndex) && readSheetDraft(matchLogId, setIndex) !== null;
  const canGoOffline =
    (failed || (!loaded && slowKey === loadKey)) &&
    Number.isInteger(setIndex) &&
    (hasDraft || readListCache(matchLogId) !== null);
  const draftButton = canGoOffline && (
    <Button className="h-11" onClick={() => setDraftKey(sheetKey)}>
      {hasDraft ? '以本機草稿繼續' : '離線繼續'}
    </Button>
  );

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          載入中…
        </div>
        {draftButton}
      </div>
    );
  }
  if (!okData) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">無法載入記錄單，請確認網路後重試</p>
        <div className="flex flex-wrap justify-center gap-2">
          {draftButton}
          <Button variant="outline" className="h-11" onClick={() => setTick((t) => t + 1)}>
            重試
          </Button>
          <Link to={listPath} className="inline-flex h-11 items-center px-4 text-sm text-primary">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const data = okData;
  const server = data.sheets.find((s) => s.setIndex === setIndex) ?? null;
  const maxIndex = data.sheets.reduce((m, s) => Math.max(m, s.setIndex), 0);
  const valid =
    Number.isInteger(setIndex) && (server !== null || (setIndex === maxIndex + 1 && setIndex <= MAX_SET_INDEX));
  if (!valid) return <Navigate to={listPath} replace />;

  return <SheetEditor key={sheetKey} data={data} setIndex={setIndex} server={server} listPath={listPath} />;
}
