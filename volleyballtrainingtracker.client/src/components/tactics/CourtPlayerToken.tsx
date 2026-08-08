import { cn } from "@/lib/utils";
import type { CourtPlayer } from "@/lib/court";
import { roleTokenClass } from "./tokenStyle";

interface Props {
  player: CourtPlayer;
  dragging: boolean;
  /**
   * false＝畫線模式中：完全停用 pointer 事件，避免畫線誤拖球員（捕捉層之外的雙保險）。
   * true＝選取模式：另外把 token 疊到戰術線層之上（見下方 z-index），
   * 讓命中帶加寬後仍被線條穿過的球員可以被點中。
   */
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
        "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 touch-none select-none",
        "flex-col items-center justify-center rounded-full shadow-lift cursor-grab",
        roleTokenClass(player.role),
        // 選取模式下 token 疊到戰術線層（VolleyballCourt 的 z-[15]）之上：
        // 命中帶在螢幕上固定為 44px（見 hitStrokeWidthFor），比 token 直徑（48px）
        // 還寬，線條穿過 token 中心時幾乎完全覆蓋它，選取模式下若疊層順序不變，
        // 使用者按下球員會被線條的命中區搶走、變成選取到線。
        // 取捨：戰術線因此會畫在球員圓標下方，可接受（球員是操作主體）。
        // 畫線／橡皮擦模式維持原疊層即可：token 此時已 pointer-events-none，
        // 疊層順序不影響「畫線絕不誤拖球員」的既有保證。
        interactive ? "z-20" : "z-10",
        dragging
          ? "z-30 scale-110 cursor-grabbing ring-2 ring-ring"
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
