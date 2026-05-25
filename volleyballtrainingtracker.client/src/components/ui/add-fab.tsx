import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AddFabProps {
  /** 按鈕文字（同時作為 title 提示），例如「新增比賽」 */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** 額外樣式（如需在特定情況微調位置） */
  className?: string;
}

/**
 * 浮動新增按鈕（Extended FAB）。
 *
 * 固定於畫面右下角，捲動到任何位置都點得到，解決「長清單要滑回頂部才能新增」的問題。
 * 行動版底部有 BottomTabBar（h-16、z-30），故以 `+5rem` 墊高避開，並用 z-40 蓋在其上；
 * 桌面版無底部列，落在 `lg:bottom-6`。定位慣例與 Players 比較列、MatchLogs 一致。
 */
export function AddFab({ label, onClick, disabled, className }: AddFabProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "fixed right-4 lg:right-6 bottom-[calc(env(safe-area-inset-bottom)+5rem)] lg:bottom-6 z-40 h-12 rounded-full px-5 shadow-lift animate-slide-up",
        className,
      )}
    >
      <Plus className="h-5 w-5 mr-1.5" /> {label}
    </Button>
  );
}
