import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { RosterPlayer } from "@/lib/court";
import { POSITION_LABELS, primaryPosition } from "@/lib/positions";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  slotLabel: string;
  roster: RosterPlayer[];
  currentId: number | null;
  onPick: (player: RosterPlayer | null) => void;
  onClose: () => void;
}

/** 替某個位置格子挑選球員（只影響顯示）；選到已在別格的球員時由呼叫端互換 */
export default function SlotPlayerPicker({ open, slotLabel, roster, currentId, onPick, onClose }: Props) {
  const sorted = [...roster].sort(
    (a, b) => (a.jerseyNo ?? Number.POSITIVE_INFINITY) - (b.jerseyNo ?? Number.POSITIVE_INFINITY),
  );
  return (
    <Dialog open={open} onClose={onClose} title={`選擇「${slotLabel}」的球員`} size="sm">
      <div className="max-h-[60dvh] space-y-1 overflow-y-auto p-4">
        {sorted.map((p) => {
          const pos = primaryPosition(p.position);
          return (
            <button
              key={p.playerId}
              type="button"
              onClick={() => onPick(p)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted",
                p.playerId === currentId && "bg-primary/10 font-semibold",
              )}
            >
              <span className="w-8 text-right tabular-nums">{p.jerseyNo ?? "–"}</span>
              <span className="flex-1">{p.name}</span>
              <span className="text-xs text-muted-foreground">{pos ? POSITION_LABELS[pos] ?? pos : ""}</span>
            </button>
          );
        })}
        <Button variant="ghost" className="w-full" onClick={() => onPick(null)}>
          清除（顯示位置代號）
        </Button>
      </div>
    </Dialog>
  );
}
