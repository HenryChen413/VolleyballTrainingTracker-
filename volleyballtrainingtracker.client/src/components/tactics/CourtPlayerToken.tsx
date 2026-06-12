import { cn } from "@/lib/utils";
import type { CourtPlayer } from "@/lib/court";
import { roleTokenClass } from "./tokenStyle";

interface Props {
  player: CourtPlayer;
  dragging: boolean;
  /** false＝畫線模式中：完全停用 pointer 事件，避免畫線誤拖球員（捕捉層之外的雙保險） */
  interactive: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

/**
 * 場上球員 token：顯示背號＋姓名，支援拖曳移動／交換、雙擊（雙點）移出場地。
 * 雙擊偵測由 VolleyballCourt 在 pointerup 自行判定（dblclick 在觸控下不可靠），
 * 本元件僅轉發 pointer 事件。
 */
export default function CourtPlayerToken({
  player,
  dragging,
  interactive,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: Props) {
  return (
    <button
      type="button"
      // touch-action: none 只加在 token 本身，場地空白處仍可正常捲動頁面
      className={cn(
        "absolute z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 touch-none select-none",
        "flex-col items-center justify-center rounded-full shadow-lift cursor-grab",
        roleTokenClass(player.role),
        dragging
          ? "z-20 scale-110 cursor-grabbing ring-2 ring-ring"
          : "transition-[left,top] duration-150 ease-out",
        !interactive && "pointer-events-none",
      )}
      style={{ left: `${player.x * 100}%`, top: `${player.y * 100}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label={`${player.name}（背號 ${player.jerseyNo ?? "無"}），拖曳移動，雙擊移出場地`}
    >
      <span className="text-sm font-bold leading-none tabular-nums">
        {player.jerseyNo ?? "–"}
      </span>
      <span className="mt-0.5 max-w-[44px] truncate text-[10px] leading-none">
        {player.name}
      </span>
    </button>
  );
}
