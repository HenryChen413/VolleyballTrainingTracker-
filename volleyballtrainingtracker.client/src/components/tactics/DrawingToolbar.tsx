import { Eraser, MousePointer2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DRAWING_COLORS,
  DRAWING_WIDTHS,
  type DrawingTool,
} from "@/lib/drawing";
import type { DrawingStyle } from "./useTacticsDrawings";

const TOOLS: ReadonlyArray<{
  value: DrawingTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "select", label: "選取", icon: MousePointer2 },
  { value: "draw", label: "畫", icon: Pencil },
  { value: "eraser", label: "橡皮擦", icon: Eraser },
];

interface Props {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  style: DrawingStyle;
  /** 變更顏色／粗細：套用到下一條線；有選取中的線時同步修改它 */
  onStyleChange: (patch: Partial<DrawingStyle>) => void;
  selectedId: string | null;
  onDeleteSelected: () => void;
}

/**
 * 戰術畫線工具列：工具切換、顏色、粗細、刪除選取。
 * 「清除全部畫線」不放這裡 —— 它與選取狀態無關，且排在 3 工具＋6 色＋3 粗細
 * 之後會被擠到換行而難以發現，改與「清空場地」一起放在場地標題列（TacticsToolbar）。
 */
export default function DrawingToolbar({
  tool,
  onToolChange,
  style,
  onStyleChange,
  selectedId,
  onDeleteSelected,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* 工具切換 */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        {TOOLS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            size="sm"
            variant={tool === value ? "default" : "ghost"}
            className="px-2.5"
            onClick={() => onToolChange(value)}
            title={label}
            aria-label={label}
            aria-pressed={tool === value}
          >
            <Icon className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>

      {/* 顏色 */}
      <div className="flex items-center gap-1.5" role="group" aria-label="線條顏色">
        {DRAWING_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={cn(
              "h-6 w-6 rounded-full border border-border/60 transition-transform",
              style.color === c && "scale-110 ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            style={{ backgroundColor: c }}
            onClick={() => onStyleChange({ color: c })}
            title={`線色 ${c}`}
            aria-label={`線色 ${c}`}
            aria-pressed={style.color === c}
          />
        ))}
      </div>

      {/* 粗細 */}
      <div className="flex items-center gap-1" role="group" aria-label="線條粗細">
        {DRAWING_WIDTHS.map((w) => (
          <button
            key={w.value}
            type="button"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
              style.width === w.value
                ? "border-primary bg-primary/10"
                : "border-transparent hover:bg-accent",
            )}
            onClick={() => onStyleChange({ width: w.value })}
            title={`粗細：${w.label}`}
            aria-label={`粗細：${w.label}`}
            aria-pressed={style.width === w.value}
          >
            <span
              className="block w-5 rounded-full bg-foreground"
              style={{ height: `${Math.max(2, Math.round(w.value / 1.8))}px` }}
            />
          </button>
        ))}
      </div>

      {/* 刪除選取（僅在有選取線條時出現） */}
      {selectedId && (
        <div className="flex items-center gap-1 border-l pl-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteSelected}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" /> 刪除選取
          </Button>
        </div>
      )}
    </div>
  );
}
