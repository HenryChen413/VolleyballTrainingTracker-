import { useEffect, useRef, useState } from "react";
import { Shrink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fitCourtSize, type CourtPlayer } from "@/lib/court";
import type { Drawing, DrawingTool } from "@/lib/drawing";
import FocusModeToolbar from "./FocusModeToolbar";
import VolleyballCourt from "./VolleyballCourt";
import type { DrawingStyle } from "./useTacticsDrawings";

/** 寬螢幕改用側邊直欄的門檻（px），對應 Tailwind md 斷點 */
const VERTICAL_TOOLBAR_MIN_WIDTH = 768;
/** 手機置底工具列預留高度（px） */
const HORIZONTAL_TOOLBAR_HEIGHT = 68;
/** 側欄工具列預留寬度（px） */
const VERTICAL_TOOLBAR_WIDTH = 76;

interface Props {
  onExit: () => void;
  /** true＝CSS 假全螢幕，需自行蓋滿視窗；原生全螢幕時瀏覽器已處理 */
  cssFullscreen: boolean;
  // ── 場地 ──
  courtPlayers: CourtPlayer[];
  courtRef: React.RefObject<HTMLDivElement | null>;
  rosterRef: React.RefObject<HTMLDivElement | null>;
  onMovePlayer: (playerId: number, x: number, y: number) => void;
  onSwapPlayers: (d: number, t: number, s: { x: number; y: number }) => void;
  onRemovePlayer: (playerId: number) => void;
  // ── 畫線 ──
  tool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
  drawings: Drawing[];
  drawStyle: DrawingStyle;
  onStyleChange: (patch: Partial<DrawingStyle>) => void;
  arrowEnabled: boolean;
  onArrowEnabledChange: (v: boolean) => void;
  selectedDrawingId: string | null;
  onAddDrawing: (d: Drawing) => void;
  onUpdateDrawing: (id: string, patch: Partial<Omit<Drawing, "id">>) => void;
  onRemoveDrawing: (id: string) => void;
  onSelectDrawing: (id: string | null) => void;
  onClearAll: () => void;
}

/**
 * 戰術板專注模式：全螢幕 overlay，只有場地、工具列與退出鈕。
 *
 * 場地尺寸以 JS 依可用空間計算（fitCourtSize），確保**整個場地永遠完整可見** ——
 * 這是本模式存在的理由：一般模式下場地高度超過行動裝置可視區，
 * 無法一筆從對方場區畫到我方場區。
 *
 * 狀態全部由呼叫端傳入，本元件不持有任何草稿資料，
 * 因此進出專注模式不會遺失已畫的線或站位。
 */
export default function TacticsFocusMode({
  onExit,
  cssFullscreen,
  courtRef,
  tool,
  onToolChange,
  drawStyle,
  onStyleChange,
  arrowEnabled,
  onArrowEnabledChange,
  selectedDrawingId,
  onRemoveDrawing,
  drawings,
  onClearAll,
  ...courtProps
}: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vertical = box.w >= VERTICAL_TOOLBAR_MIN_WIDTH;
  const availW = box.w - (vertical ? VERTICAL_TOOLBAR_WIDTH : 0);
  const availH = box.h - (vertical ? 0 : HORIZONTAL_TOOLBAR_HEIGHT);
  const size = fitCourtSize(availW, availH);

  return (
    <div
      ref={shellRef}
      className={cn(
        "flex bg-background",
        vertical ? "flex-row items-center" : "flex-col items-center",
        // 原生全螢幕時瀏覽器已把元素放大到整個螢幕，只需填滿；
        // CSS 假全螢幕要自己蓋掉 header 與 BottomTabBar，h-dvh 避開網址列造成的跳動
        cssFullscreen
          ? "fixed inset-0 z-[100] h-dvh w-screen"
          : "h-dvh w-full",
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={onExit}
        title="退出專注模式"
        aria-label="退出專注模式"
        className="absolute left-2 top-2 z-10 h-11 w-11"
        style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <Shrink className="h-5 w-5" />
      </Button>

      {/* 場地：尺寸由 JS 算好，確保整場可見 */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: size.width, height: size.height }}>
          {size.width > 0 && (
            <VolleyballCourt
              {...courtProps}
              className="relative h-full w-full select-none"
              courtRef={courtRef}
              tool={tool}
              drawings={drawings}
              drawStyle={drawStyle}
              arrowEnabled={arrowEnabled}
              selectedDrawingId={selectedDrawingId}
              onRemoveDrawing={onRemoveDrawing}
            />
          )}
        </div>
      </div>

      {/* 工具列：手機置底、寬螢幕靠右直欄 */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center",
          vertical ? "h-full px-2" : "w-full pb-[env(safe-area-inset-bottom)]",
        )}
        style={vertical ? { width: VERTICAL_TOOLBAR_WIDTH } : { height: HORIZONTAL_TOOLBAR_HEIGHT }}
      >
        <FocusModeToolbar
          orientation={vertical ? "vertical" : "horizontal"}
          tool={tool}
          onToolChange={onToolChange}
          style={drawStyle}
          onStyleChange={onStyleChange}
          arrowEnabled={arrowEnabled}
          onArrowEnabledChange={onArrowEnabledChange}
          selectedId={selectedDrawingId}
          onDeleteSelected={() => selectedDrawingId && onRemoveDrawing(selectedDrawingId)}
          drawingCount={drawings.length}
          onClearAll={onClearAll}
        />
      </div>
    </div>
  );
}
