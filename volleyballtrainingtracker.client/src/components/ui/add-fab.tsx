import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AddFabProps {
  /** 按鈕文字（同時作為 title 與無障礙名稱），例如「新增比賽」 */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** 額外樣式（如需在特定情況微調位置） */
  className?: string;
}

/** 方向判定門檻（px）：小於此值的抖動不改變收合狀態。 */
const SCROLL_THRESHOLD = 8;

/**
 * 向下捲動時回傳 true（應收合），向上捲動或回到頁頂時回傳 false。
 *
 * 刻意「不」在停止捲動後自動展開：使用者停下來多半是要點選當下那一列，
 * 此時按鈕再長回完整寬度就會重新蓋住卡片，等於沒解決遮擋問題。
 * 要恢復完整按鈕只需往上滑一下。
 */
function useCollapseOnScrollDown() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < SCROLL_THRESHOLD) return;
      lastY = y;
      // y <= 0 涵蓋 iOS 頂部彈性回捲的負值，一律視為在頁頂。
      setCollapsed(y > 0 && delta > 0);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return collapsed;
}

/**
 * 浮動新增按鈕（Extended FAB）。
 *
 * 固定於畫面右下角，捲動到任何位置都點得到，解決「長清單要滑回頂部才能新增」的問題。
 * 行動版底部有 BottomTabBar（h-16、z-30），故以 `+5rem` 墊高避開，並用 z-40 蓋在其上；
 * 桌面版無底部列，落在 `lg:bottom-6`。定位慣例與 Players 比較列、MatchLogs 一致。
 *
 * 行動版寬度有限，帶文字的按鈕會蓋住清單右側、使該列點不到，
 * 故向下捲動時收合成圓形圖示鈕，向上捲動再展開；
 * 桌面版空間充足，以 `lg:` 覆寫維持恆常展開。
 */
export function AddFab({ label, onClick, disabled, className }: AddFabProps) {
  const collapsed = useCollapseOnScrollDown();

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      data-collapsed={collapsed}
      className={cn(
        "fixed right-4 lg:right-6 bottom-[calc(env(safe-area-inset-bottom)+5rem)] lg:bottom-6 z-40 h-12 rounded-full shadow-lift animate-slide-up",
        "overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-12 px-0 lg:w-auto lg:px-5" : "px-5",
        className,
      )}
    >
      <Plus className="h-5 w-5 shrink-0" />
      <span
        aria-hidden="true"
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none",
          collapsed
            ? "max-w-0 opacity-0 lg:max-w-[10rem] lg:opacity-100 lg:ml-1.5"
            : "max-w-[10rem] opacity-100 ml-1.5",
        )}
      >
        {label}
      </span>
    </Button>
  );
}
