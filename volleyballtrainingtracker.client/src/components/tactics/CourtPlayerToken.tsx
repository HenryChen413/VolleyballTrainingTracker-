import { cn } from "@/lib/utils";
import type { CourtPlayer } from "@/lib/court";
import { roleTokenClass } from "./tokenStyle";

interface Props {
  player: CourtPlayer;
  dragging: boolean;
  /**
   * false＝畫線模式中：完全停用 pointer 事件，避免畫線誤拖球員（捕捉層之外的雙保險）。
   * true＝選取模式：另外把 token 疊到戰術線「線身」層之上、「端點控制點」層之下
   * （見下方 z-index），讓命中帶加寬後仍被線條穿過的球員可以被點中。
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
        // z 疊層由下而上：戰術線「線身」（VolleyballCourt 的 z-[15]）→ 閒置 token
        // （z-20）→ 戰術線「端點控制點」（z-[25]）→ 拖曳中 token（z-30）。拆成
        // 兩層是刻意的：
        // - 線身命中帶在螢幕上固定為 44px（見 hitStrokeWidthFor），比 token 直徑
        //   （48px）還寬，若跟 token 同層，線條穿過 token 中心時會幾乎完全覆蓋
        //   它，使用者按下球員會被線條命中區搶走、變成選取到線，故留在 token 之下
        //   （取捨：戰術線因此畫在球員圓標下方，可接受，球員是操作主體）。
        // - 端點控制點則相反：它只在選取一條線後才出現，是使用者明確要拖的目標，
        //   即使端點剛好落在球員身上也必須拖得到，優先權高於球員，故疊在 token
        //   之上；拖曳中的 token 再蓋過端點與其他閒置 token（z-30）。
        // 畫線／橡皮擦模式下疊層順序不影響互動：token 此時已 pointer-events-none，
        // 「畫線絕不誤拖球員」的既有保證不受影響。
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
