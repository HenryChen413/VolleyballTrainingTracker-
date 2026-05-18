import { Check } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import {
  POSITION_LABELS,
  POSITION_TONE,
  parsePositions,
} from "@/lib/positions";

export interface RosterChipPlayer {
  name: string;
  jerseyNo: number | null;
  position: string | null;
}

interface BaseProps {
  player: RosterChipPlayer;
  className?: string;
}

// 分隊配色：與列表頁 SquadBlock 的 chip tone 一致（A=primary、B=info）
type SquadTone = "primary" | "info";
const SQUAD_STYLE: Record<SquadTone, {
  chip: string;
  bubble: string;
  check: string;
  segActive: string;
}> = {
  primary: {
    chip: "border-primary bg-primary/5 shadow-soft",
    bubble: "bg-primary text-primary-foreground",
    check: "text-primary",
    segActive: "bg-primary text-primary-foreground",
  },
  info: {
    chip: "border-info bg-info/10 shadow-soft",
    bubble: "bg-info text-info-foreground",
    check: "text-info",
    segActive: "bg-info text-info-foreground",
  },
};

function toneOf(squad: string | null | undefined): SquadTone {
  return squad === "B" ? "info" : "primary";
}

/** 唯讀版：顯示用，整個 chip 不可點 */
export function RosterChip({ player, className }: BaseProps) {
  return (
    <ChipShell
      player={player}
      className={cn("border-border bg-card", className)}
    />
  );
}

/** 可選版：點擊切換選中狀態（用於編輯頁名單挑選） */
export function SelectableRosterChip({
  player,
  selected,
  onClick,
  className,
  showSquadPicker,
  squad,
  onSquadChange,
}: BaseProps & {
  selected: boolean;
  onClick: () => void;
  /** 分隊模式：顯示底部 [A][B] 切換器（僅 selected 時可見） */
  showSquadPicker?: boolean;
  squad?: string | null;
  onSquadChange?: (next: string | null) => void;
}) {
  const tone = showSquadPicker ? toneOf(squad) : "primary";
  const style = SQUAD_STYLE[tone];
  return (
    <div
      className={cn(
        "relative rounded-lg border transition-all overflow-hidden",
        selected
          ? style.chip
          : "border-border bg-card hover:bg-accent/40",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-2.5 flex items-center gap-2.5"
      >
        <Bubble
          jerseyNo={player.jerseyNo}
          highlightedClass={selected ? style.bubble : undefined}
        />
        <Body player={player} />
        {selected && (
          <Check className={cn("absolute top-1 right-1 h-3.5 w-3.5", style.check)} />
        )}
      </button>
      {selected && showSquadPicker && (
        <div className="border-t border-border/60 bg-background/40 p-1.5">
          <SquadSegmented value={squad ?? null} onChange={onSquadChange} />
        </div>
      )}
    </div>
  );
}

function SquadSegmented({
  value,
  onChange,
}: {
  value: string | null;
  onChange?: (next: string | null) => void;
}) {
  // 固定 A / B 兩選一，各自用對應配色標示 active
  const options: { key: string; label: string; val: string; tone: SquadTone }[] = [
    { key: "A", label: "A", val: "A", tone: "primary" },
    { key: "B", label: "B", val: "B", tone: "info" },
  ];
  return (
    <div
      className="inline-flex w-full rounded-md border border-border/80 bg-muted/40 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt) => {
        const active = value === opt.val;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange?.(opt.val)}
            className={cn(
              "flex-1 text-xs font-medium py-1 transition-colors",
              active
                ? SQUAD_STYLE[opt.tone].segActive
                : "text-muted-foreground hover:bg-accent/40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── internals ────────────────────────────────────────────────────────────
function ChipShell({ player, className }: BaseProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 flex items-center gap-2.5",
        className,
      )}
    >
      <Bubble jerseyNo={player.jerseyNo} />
      <Body player={player} />
    </div>
  );
}

function Bubble({
  jerseyNo,
  highlightedClass,
}: {
  jerseyNo: number | null;
  highlightedClass?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 w-9 h-9 rounded-md flex items-center justify-center font-numeric font-bold text-sm",
        highlightedClass ?? "bg-muted text-muted-foreground",
      )}
    >
      {jerseyNo ?? "-"}
    </div>
  );
}

function Body({ player }: { player: RosterChipPlayer }) {
  const positions = parsePositions(player.position);
  return (
    <div className="flex-1 min-w-0">
      <div className="font-medium text-sm truncate">{player.name}</div>
      {positions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {positions.map((p) => (
            <Chip key={p} tone={POSITION_TONE[p] ?? "neutral"} size="sm">
              {POSITION_LABELS[p] ?? p}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
