import { X } from 'lucide-react';
import { STAT_GROUPS, type StatKey } from '@/lib/scoresheet/columns';
import type { SheetRow } from '@/lib/scoresheet/sheet';
import { autoOurErrors } from '@/lib/scoresheet/totals';
import { cn } from '@/lib/utils';
import { useLongPress } from './useLongPress';

interface StatGridProps {
  rows: SheetRow[];
  oppErrors: number;
  /** 手動補記的我方失誤；畫面顯示為「格子自動加總 ＋ 此值」 */
  ourErrors: number;
  /** 唯讀模式：不渲染任何按鈕與事件處理（整場合計、回看用） */
  readOnly?: boolean;
  onBump?: (playerId: number, key: StatKey, delta: 1 | -1) => void;
  onBumpErrors?: (side: 'opp' | 'our', delta: 1 | -1) => void;
  onRemoveRow?: (playerId: number) => void;
  /** 有給時在「隊員」後多一欄「局數」（整場合計用），key 為 playerId */
  setsPlayed?: Record<number, number>;
  /** 替補標記（playerId → 「替」或「替7」），見 subMarks */
  marks?: Record<number, string>;
}

/** 觸控用：避免長按選字、iOS 放大鏡與系統選單，並取消雙擊縮放延遲 */
const TOUCH_CLASS = 'select-none touch-manipulation [-webkit-touch-callout:none]';

const COLS = STAT_GROUPS.flatMap((g) => g.cols.map((c) => ({ ...c, group: g.title })));

/** 可點（+1）／長按（−1）的計數格 */
function TapCell({
  label,
  value,
  onDelta,
  className,
}: {
  label: string;
  value: number;
  onDelta: (delta: 1 | -1) => void;
  className?: string;
}) {
  const handlers = useLongPress({ onClick: () => onDelta(1), onLongPress: () => onDelta(-1) });
  return (
    <button
      type="button"
      aria-label={label}
      {...handlers}
      className={cn(
        TOUCH_CLASS,
        'flex min-h-11 min-w-11 w-full items-center justify-center rounded-md text-base tabular-nums',
        'active:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        value === 0 ? 'text-muted-foreground/50' : 'font-semibold text-foreground',
        className,
      )}
    >
      {value}
    </button>
  );
}

function StaticCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        'flex min-h-11 min-w-11 items-center justify-center tabular-nums',
        value === 0 ? 'text-muted-foreground/50' : 'font-semibold',
      )}
    >
      {value}
    </span>
  );
}

const rowLabel = (r: SheetRow) => (r.jerseyNo != null ? String(r.jerseyNo) : '');

/** 記錄單球員表格：欄位順序與紙本一致；下方為對方／我方失誤計數 */
export function StatGrid({
  rows, oppErrors, ourErrors, readOnly, onBump, onBumpErrors, onRemoveRow, setsPlayed, marks,
}: StatGridProps) {
  const canEdit = !readOnly;
  const autoErrors = autoOurErrors(rows);
  const counter = (side: 'opp' | 'our', label: string, value: number, note?: string) => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {canEdit ? (
        <TapCell
          label={label}
          value={value}
          onDelta={(d) => onBumpErrors?.(side, d)}
          className="w-auto border bg-card px-3"
        />
      ) : (
        <StaticCell value={value} />
      )}
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th
                rowSpan={2}
                scope="col"
                className="sticky left-0 z-10 border-b border-r bg-muted px-2 py-1 text-left font-medium"
              >
                隊員
              </th>
              {setsPlayed && (
                <th rowSpan={2} scope="col" className="border-b border-r px-1 py-1 font-medium">
                  局數
                </th>
              )}
              {STAT_GROUPS.map((g) => (
                <th key={g.title} colSpan={g.cols.length} scope="colgroup" className="border-b border-r px-1 py-1 font-medium">
                  {g.title}
                </th>
              ))}
              {canEdit && onRemoveRow && <td rowSpan={2} className="border-b" />}
            </tr>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} scope="col" className="border-b border-r px-1 py-0.5 font-normal text-muted-foreground">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 3} className="px-3 py-6 text-center text-muted-foreground">
                  尚未加入隊員
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.playerId} className="border-b last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[7rem] border-r bg-card px-2 text-left font-medium"
                >
                  <span className="mr-1 text-xs text-muted-foreground tabular-nums">{rowLabel(r)}</span>
                  <span className="truncate">{r.name}</span>
                  {marks?.[r.playerId] && (
                    <span
                      title={marks[r.playerId] === '替' ? '替補' : `替補，換下 ${marks[r.playerId].slice(1)}`}
                      className="ml-1 whitespace-nowrap rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    >
                      {marks[r.playerId]}
                    </span>
                  )}
                </th>
                {setsPlayed && (
                  <td className="border-r bg-muted/30 p-0 text-center">
                    <StaticCell value={setsPlayed[r.playerId] ?? 0} />
                  </td>
                )}
                {COLS.map((c) => {
                  const v = r.counts[c.key] ?? 0;
                  return (
                    <td key={c.key} className="border-r p-0 text-center">
                      {canEdit ? (
                        <TapCell
                          label={`${r.name} ${c.group}${c.label ? ` ${c.label}` : ''}`}
                          value={v}
                          onDelta={(d) => onBump?.(r.playerId, c.key, d)}
                        />
                      ) : (
                        <StaticCell value={v} />
                      )}
                    </td>
                  );
                })}
                {canEdit && onRemoveRow && (
                  <td className="p-0">
                    <button
                      type="button"
                      aria-label={`移除 ${r.name}`}
                      title={`移除 ${r.name}`}
                      onClick={() => onRemoveRow(r.playerId)}
                      className="flex h-11 w-11 items-center justify-center text-muted-foreground active:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {counter('opp', '對方失誤', oppErrors)}
        {/* 點／長按只增減手動補記的部分；自動部分隨格子變動 */}
        {counter('our', '我方失誤', autoErrors + ourErrors, `自動 ${autoErrors} ＋ 手動 ${ourErrors}`)}
      </div>
    </div>
  );
}
