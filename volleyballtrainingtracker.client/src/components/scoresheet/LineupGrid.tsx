import type { SheetRow } from '@/lib/scoresheet/sheet';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface LineupGridProps {
  /** 長度 6，索引 0..5 = 1..6 號位 */
  lineup: (number | null)[];
  /** 長度 2，[接發自由, 防守自由] */
  liberos: (number | null)[];
  rows: SheetRow[];
  onChange: (slot: number, playerId: number | null) => void;
  onLiberoChange: (slot: number, playerId: number | null) => void;
  /** inline：自由兩格疊在站位右側（頁首）；stacked：自由兩格並排在站位下方（對話框） */
  layout?: 'inline' | 'stacked';
}

/** 面向球網視角：上排前排 4-3-2、下排後排 5-6-1（值為 lineup 索引） */
const LAYOUT = [3, 2, 1, 4, 5, 0];
const LIBERO_LABELS = ['接發自由', '防守自由'];

function PlayerSelect({
  label,
  value,
  rows,
  exclude,
  onChange,
}: {
  label: string;
  value: number | null;
  rows: SheetRow[];
  exclude: Set<number | null>;
  onChange: (playerId: number | null) => void;
}) {
  const options = rows.filter((r) => !exclude.has(r.playerId));
  return (
    <label className="flex flex-col text-[10px] text-muted-foreground">
      <span>{label}</span>
      <Select
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="h-11 w-24 px-1 text-sm text-foreground"
      >
        <option value="">—</option>
        {options.map((r) => (
          <option key={r.playerId} value={r.playerId}>
            {r.jerseyNo != null ? `${r.jerseyNo} ` : ''}
            {r.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

/**
 * 第一球站位 2×3 格＋自由球員兩格：每格從本局已加入的球員挑選或留空。
 * 攔中照填號位，自由只記錄這局用了誰，不模擬換人。
 */
export function LineupGrid({ lineup, liberos, rows, onChange, onLiberoChange, layout = 'inline' }: LineupGridProps) {
  // 已排在其他格（號位或自由）的球員不再列出，避免同一人出現兩次
  const usedExcept = (kind: 'lineup' | 'libero', slot: number) =>
    new Set([
      ...lineup.filter((id, i) => !(kind === 'lineup' && i === slot) && id != null),
      ...liberos.filter((id, i) => !(kind === 'libero' && i === slot) && id != null),
    ]);

  return (
    <div className={cn('flex gap-2', layout === 'stacked' ? 'flex-col items-center' : 'items-start')}>
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="第一球站位">
        {LAYOUT.map((slot) => (
          <PlayerSelect
            key={slot}
            label={`${slot + 1} 號位`}
            value={lineup[slot] ?? null}
            rows={rows}
            exclude={usedExcept('lineup', slot)}
            onChange={(id) => onChange(slot, id)}
          />
        ))}
      </div>
      <div
        className={cn('grid gap-1', layout === 'stacked' ? 'grid-cols-2' : 'grid-rows-2')}
        role="group"
        aria-label="自由球員"
      >
        {LIBERO_LABELS.map((label, slot) => (
          <PlayerSelect
            key={label}
            label={label}
            value={liberos[slot] ?? null}
            rows={rows}
            exclude={usedExcept('libero', slot)}
            onChange={(id) => onLiberoChange(slot, id)}
          />
        ))}
      </div>
    </div>
  );
}
