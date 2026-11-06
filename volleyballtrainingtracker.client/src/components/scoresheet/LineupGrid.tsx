import type { SheetRow } from '@/lib/scoresheet/sheet';
import { Select } from '@/components/ui/select';

interface LineupGridProps {
  /** 長度 6，索引 0..5 = 1..6 號位 */
  lineup: (number | null)[];
  rows: SheetRow[];
  onChange: (slot: number, playerId: number | null) => void;
}

/** 面向球網視角：上排前排 4-3-2、下排後排 5-6-1（值為 lineup 索引） */
const LAYOUT = [3, 2, 1, 4, 5, 0];

/** 第一球站位 2×3 格：每格從本局已加入的球員挑選或留空 */
export function LineupGrid({ lineup, rows, onChange }: LineupGridProps) {
  return (
    <div className="grid grid-cols-3 gap-1" role="group" aria-label="第一球站位">
      {LAYOUT.map((slot) => {
        const current = lineup[slot] ?? null;
        // 已排在其他號位的球員不再列出，避免同一人站兩個位置
        const used = new Set(lineup.filter((id, i) => i !== slot && id != null));
        const options = rows.filter((r) => !used.has(r.playerId));
        return (
          <label key={slot} className="flex flex-col text-[10px] text-muted-foreground">
            <span>{slot + 1} 號位</span>
            <Select
              aria-label={`${slot + 1} 號位`}
              value={current ?? ''}
              onChange={(e) => onChange(slot, e.target.value === '' ? null : Number(e.target.value))}
              className="h-11 w-24 px-1 text-sm text-foreground"
            >
              <option value="">—</option>
              {options.map((r) => (
                <option key={r.playerId} value={r.playerId}>
                  {r.jerseyNo != null ? `#${r.jerseyNo} ` : ''}
                  {r.name}
                </option>
              ))}
            </Select>
          </label>
        );
      })}
    </div>
  );
}
