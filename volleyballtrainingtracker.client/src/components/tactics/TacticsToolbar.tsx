import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/lib/swal";

interface Props {
  /** 已上場人數 */
  onCourtCount: number;
  /** 名單總人數 */
  totalCount: number;
  onClear: () => void;
}

/**
 * 戰術板動作列。Phase 1 僅「清空場地」；
 * 後續 Phase 的儲存／畫線／輪轉／匯出按鈕將集中加在這裡。
 */
export default function TacticsToolbar({ onCourtCount, totalCount, onClear }: Props) {
  const handleClear = async () => {
    const res = await confirmAction(
      "清空場地？",
      `目前有 ${onCourtCount} 名球員在場上，全部移回名單區。`,
      "清空",
      true,
    );
    if (res.isConfirmed) onClear();
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground tabular-nums">
        已上場 {onCourtCount} / {totalCount}
      </span>
      {onCourtCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-destructive hover:text-destructive"
        >
          <Eraser className="mr-1 h-4 w-4" /> 清空場地
        </Button>
      )}
    </div>
  );
}
