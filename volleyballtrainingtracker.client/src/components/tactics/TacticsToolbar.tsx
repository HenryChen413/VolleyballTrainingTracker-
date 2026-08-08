import { Eraser, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/lib/swal";

interface Props {
  /** 已上場人數 */
  onCourtCount: number;
  /** 名單總人數 */
  totalCount: number;
  onClear: () => void;
  /** 目前戰術線條數 */
  drawingCount: number;
  onClearDrawings: () => void;
}

/**
 * 戰術板動作列。兩個「清除」入口刻意並排在場地標題列，
 * 各自只清一種東西：清空場地＝球員全部回名單、清除畫線＝刪掉所有戰術線，
 * 互不影響（畫線工具列只留與選取狀態連動的「刪除選取」）。
 */
export default function TacticsToolbar({
  onCourtCount,
  totalCount,
  onClear,
  drawingCount,
  onClearDrawings,
}: Props) {
  const handleClear = async () => {
    const res = await confirmAction(
      "清空場地？",
      `目前有 ${onCourtCount} 名球員在場上，全部移回名單區（戰術線不受影響）。`,
      "清空",
      true,
    );
    if (res.isConfirmed) onClear();
  };

  const handleClearDrawings = async () => {
    const res = await confirmAction(
      "清除全部畫線？",
      `目前有 ${drawingCount} 條戰術線，全部刪除（球員站位不受影響）。`,
      "清除",
      true,
    );
    if (res.isConfirmed) onClearDrawings();
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <span className="text-sm font-normal text-muted-foreground tabular-nums">
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
      {drawingCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearDrawings}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1 h-4 w-4" /> 清除畫線
        </Button>
      )}
    </div>
  );
}
