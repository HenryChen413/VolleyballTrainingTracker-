import { useState } from "react";
import { Eraser, MousePointer2, Palette, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DRAWING_COLORS, DRAWING_WIDTHS, type DrawingTool } from "@/lib/drawing";
import type { DrawingStyle } from "./useTacticsDrawings";

const TOOLS: ReadonlyArray<{
  value: DrawingTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "draw", label: "畫", icon: Pencil },
  { value: "select", label: "選取", icon: MousePointer2 },
  { value: "eraser", label: "橡皮擦", icon: Eraser },
];

interface Props {
  /** horizontal＝手機置底、vertical＝寬螢幕側邊直欄 */
  orientation: "horizontal" | "vertical";
  tool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
  style: DrawingStyle;
  onStyleChange: (patch: Partial<DrawingStyle>) => void;
  arrowEnabled: boolean;
  onArrowEnabledChange: (v: boolean) => void;
  selectedId: string | null;
  onDeleteSelected: () => void;
  drawingCount: number;
  onClearAll: () => void;
}

/**
 * 專注模式工具列。常駐只放場邊高頻動作（畫／選取／橡皮擦／清除全部），
 * 低頻的顏色、粗細、箭頭開關收進「樣式」面板，避免佔用拇指區。
 * 所有按鈕高寬皆 >= 44px 以符合觸控目標建議。
 */
export default function FocusModeToolbar({
  orientation,
  tool,
  onToolChange,
  style,
  onStyleChange,
  arrowEnabled,
  onArrowEnabledChange,
  selectedId,
  onDeleteSelected,
  drawingCount,
  onClearAll,
}: Props) {
  const [styleOpen, setStyleOpen] = useState(false);
  const vertical = orientation === "vertical";

  return (
    <div className={cn("relative flex items-center gap-2", vertical && "flex-col")}>
      {/* 工具切換 */}
      <div className={cn("flex gap-1 rounded-xl bg-muted/70 p-1", vertical && "flex-col")}>
        {TOOLS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            size="icon"
            variant={tool === value ? "default" : "ghost"}
            className="h-11 w-11"
            onClick={() => onToolChange(value)}
            title={label}
            aria-label={label}
            aria-pressed={tool === value}
          >
            <Icon className="h-5 w-5" />
          </Button>
        ))}
      </div>

      {/* 樣式面板開關 */}
      <Button
        size="icon"
        variant={styleOpen ? "default" : "ghost"}
        className="h-11 w-11"
        onClick={() => setStyleOpen((v) => !v)}
        title="樣式"
        aria-label="樣式"
        aria-expanded={styleOpen}
      >
        <Palette className="h-5 w-5" style={{ color: styleOpen ? undefined : style.color }} />
      </Button>

      {/* 刪除選取：僅在有選取時出現 */}
      {selectedId && (
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 text-destructive hover:text-destructive"
          onClick={onDeleteSelected}
          title="刪除選取"
          aria-label="刪除選取"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      )}

      {/* 清除全部：直接清除，由呼叫端提供可復原提示 */}
      {drawingCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-11 px-3 text-destructive hover:text-destructive"
          onClick={onClearAll}
        >
          <Eraser className="mr-1 h-5 w-5" /> 清除
        </Button>
      )}

      {/* 樣式面板 */}
      {styleOpen && (
        <div
          className={cn(
            "absolute z-10 flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-lift",
            vertical ? "right-full mr-2 top-0" : "bottom-full mb-2 left-0",
          )}
        >
          <div className="flex gap-2" role="group" aria-label="線條顏色">
            {DRAWING_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "h-11 w-11 rounded-full border border-border/60",
                  style.color === c && "ring-2 ring-ring ring-offset-2 ring-offset-card",
                )}
                style={{ backgroundColor: c }}
                onClick={() => {
                  onStyleChange({ color: c });
                  // 選色後自動收合：場邊高頻流程是「換色→立刻畫」，樣式面板
                  // 是 absolute 蓋在場地上方（見下方註解），不收合會吃掉下一筆
                  // 畫線的 pointer 事件，等於選色後畫不了線。
                  setStyleOpen(false);
                }}
                aria-label={`線色 ${c}`}
                aria-pressed={style.color === c}
              />
            ))}
          </div>

          <div className="flex gap-2" role="group" aria-label="線條粗細">
            {DRAWING_WIDTHS.map((w) => (
              <button
                key={w.value}
                type="button"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg border",
                  style.width === w.value
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-accent",
                )}
                onClick={() => {
                  onStyleChange({ width: w.value });
                  // 理由同色盤 onClick：選完粗細應立刻能畫線，不留面板擋路。
                  setStyleOpen(false);
                }}
                aria-label={`粗細：${w.label}`}
                aria-pressed={style.width === w.value}
              >
                <span
                  className="block w-6 rounded-full bg-foreground"
                  style={{ height: `${Math.max(2, Math.round(w.value / 1.8))}px` }}
                />
              </button>
            ))}
          </div>

          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={arrowEnabled}
              onChange={(e) => onArrowEnabledChange(e.target.checked)}
            />
            線尾加箭頭
          </label>
        </div>
      )}
    </div>
  );
}
