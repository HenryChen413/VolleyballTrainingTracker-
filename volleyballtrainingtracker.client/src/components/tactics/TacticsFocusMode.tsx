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
/** 手機置底工具列的基準高度（px）；螢幕的 safe-area-inset-bottom 疊加在這之上（見下方 calc），
 *  可用空間計算改用實測後的工具列尺寸，不在這裡重複扣一次安全區。 */
const HORIZONTAL_TOOLBAR_HEIGHT = 68;
/** 側欄工具列的基準寬度（px）；safe-area-inset-right 疊加在這之上（見下方 calc）。
 *  數字來源：「清除」按鈕（h-11 px-3、Eraser 圖示 20px + mr-1 4px + 全形「清除」二字約 28px、
 *  兩側 padding 各 12px）量得最小寬度約 76px，容器再留左右內距，抓 104px（含約 12px 餘裕，
 *  抵銷不同平台中文字型量測誤差），iPad 等寬螢幕裝置多這幾十 px 沒有代價。 */
const VERTICAL_TOOLBAR_WIDTH = 104;

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
  // 工具列容器：量它「實際渲染出來的」尺寸（含 safe-area），而不是重複在 JS 端
  // 算一次 CSS 的 calc() 結果——兩邊各算一次容易兜不起來（本次修正前的缺陷）。
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  // 隱形探測元素：高度純粹是 env(safe-area-inset-bottom)，讓 JS 能讀到這個
  // CSS 環境變數目前解析出的實際像素值（JS 端沒有原生方式直接讀 env()）。
  // 直欄模式下工具列在右側、不會自動扣掉底部安全區，得靠這個數字自己扣。
  const safeBottomRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [toolbarSize, setToolbarSize] = useState({ w: 0, h: 0 });
  const [safeBottomPx, setSafeBottomPx] = useState(0);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const shellEl = shellRef.current;
    const toolbarEl = toolbarRef.current;
    const safeBottomEl = safeBottomRef.current;
    if (!shellEl || !toolbarEl || !safeBottomEl) return;
    const update = () => {
      const s = shellEl.getBoundingClientRect();
      setBox({ w: s.width, h: s.height });
      const t = toolbarEl.getBoundingClientRect();
      setToolbarSize({ w: t.width, h: t.height });
      setSafeBottomPx(safeBottomEl.getBoundingClientRect().height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(shellEl);
    ro.observe(toolbarEl);
    ro.observe(safeBottomEl);
    return () => ro.disconnect();
  }, []);

  const vertical = box.w >= VERTICAL_TOOLBAR_MIN_WIDTH;
  // 直欄模式：可用寬度扣掉工具列實測寬度（已含 safe-area-inset-right）；
  // 可用高度扣掉底部安全區實測值（工具列在右側，不會幫忙擋掉 home indicator）。
  // 置底模式：可用寬度不扣；可用高度扣掉工具列實測高度（已含 safe-area-inset-bottom，
  // 不需要再另外扣一次，見 toolbarRef 的量測方式）。
  const availW = box.w - (vertical ? toolbarSize.w : 0);
  const availH = box.h - (vertical ? safeBottomPx : toolbarSize.h);
  const size = fitCourtSize(availW, availH);

  return (
    <div
      ref={shellRef}
      className={cn(
        // relative：兩個分支都需要，讓退出鈕的 absolute 有正確的定位祖先。
        // cssFullscreen=true 時 fixed 已隱含定位，relative 會被 cn/twMerge
        // 自動去重（同一組 position 工具類，後面的 fixed 蓋過 relative，無副作用）；
        // cssFullscreen=false（原生全螢幕，Android／桌機的主要路徑）時這裡原本
        // 是 static，退出鈕的 absolute 會一路往上找到「使用 useFullscreen()
        // 的呼叫端包住 TacticsFocusMode 的那層元素」（原生全螢幕會被瀏覽器
        // UA 樣式強制設成 position:fixed）而不是這個 shell，若中間還有捲動
        // 偏移，退出鈕座標會跑掉、甚至被畫到畫面外，等於卡在專注模式退不出來。
        "relative flex bg-background",
        vertical ? "flex-row items-center" : "flex-col items-center",
        // 原生全螢幕時瀏覽器已把元素放大到整個螢幕，只需填滿；
        // CSS 假全螢幕要自己蓋掉 header 與 BottomTabBar，h-dvh 避開網址列造成的跳動。
        // 不用 w-screen：inset-0 的 right:0 已經精準對齊「實際可視視窗」右緣，
        // w-screen（100vw）在有傳統捲軸的桌機瀏覽器會比可視寬多出捲軸寬度，
        // 導致 right 被重新推算、直欄工具列的最右側被裁到視窗外。
        cssFullscreen ? "fixed inset-0 z-[100] h-dvh" : "h-dvh w-full",
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={onExit}
        title="退出專注模式"
        aria-label="退出專注模式"
        className="absolute left-2 top-2 z-10 h-11 w-11"
        style={{
          top: "max(0.5rem, env(safe-area-inset-top))",
          // 左側同理：橫向大螢幕手機（如 iPhone 轉橫向）瀏海／圓角可能吃掉
          // 左側 8px，退出鈕不能只用固定的 left-2。
          left: "max(0.5rem, env(safe-area-inset-left))",
        }}
      >
        <Shrink className="h-5 w-5" />
      </Button>

      {/* 隱形探測元素：高度=env(safe-area-inset-bottom)，純粹讓 JS 能讀到這個
          安全區距離目前解析出的實際像素值（見上方 safeBottomRef 註解）。 */}
      <div
        ref={safeBottomRef}
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        style={{ height: "env(safe-area-inset-bottom)" }}
      />

      {/* 場地：尺寸由 JS 算好，確保整場可見。
          isolate（isolation: isolate）在此建立獨立堆疊脈絡，把 VolleyballCourt
          內部的 z-[15]／z-20／z-[25]／z-30（線身／閒置 token／端點／拖曳中 token
          與繪圖捕捉層）整組封裝在這層之內，不再與外層退出鈕的 z-10 比較。
          這層外側的 div（courtRef 根節點）本身只有 position:relative、
          z-index:auto，並不會自動形成堆疊脈絡，場地內部的 z 值會直接外洩到
          shellRef 這個脈絡跟退出鈕比大小——尤其畫線／橡皮擦模式下 z-30 的
          全覆蓋繪圖捕捉層會蓋過退出鈕的 z-10，導致重疊區域點不到退出鈕
          （CSS 假全螢幕下 iOS 沒有系統手勢或 ESC 可退出，會讓使用者卡住）。
          刻意選 isolate 而非把退出鈕拉高到比 30 大的 z-index：
          後者只解決「這一顆」按鈕，未來這層 overlay 再加任何新元素
          都要重新意識到同一個坑；isolate 從根本阻止場地內部的 z 值外洩，
          之後場地內部想怎麼疊都不會再影響到 overlay 的其他元素。 */}
      <div
        className={cn(
          "isolate flex flex-1 items-center justify-center overflow-hidden",
          // 直欄模式（工具列在右側）沒有底部工具列幫忙擋掉安全區，場地本身要留
          // 底部 padding，否則我方底線／畫線會壓進 home indicator 手勢區——
          // 這裡只負責「視覺上」留白，JS 端 availH 另外用 safeBottomPx 扣減，
          // 兩者算的是同一個 env(safe-area-inset-bottom)，數值必然一致。
          vertical && "pb-[env(safe-area-inset-bottom)]",
        )}
      >
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

      {/* 工具列：手機置底、寬螢幕靠右直欄。
          寬高都用 calc() 把對應的 safe-area 疊加在基準值上（border-box 下量到的
          border-box 尺寸即為此 calc 結果，TacticsFocusMode 直接讀 toolbarRef 的
          實測值來算 availW／availH，不會跟這裡的 calc 兜不起來）：
          - 置底模式：height = 基準 68px + safe-area-inset-bottom；同時保留
            pb-[env(...)] 把安全區的份量從「內容可用高度」扣掉、推到最下面當
            留白，兩者相減後 FocusModeToolbar 實際可用的內容高度仍是原本設計
            的 68px，不會因為安全區變大就把橫向工具列擠得只剩沒幾 px（此為
            本次要修的 I-2 缺陷：先前只加高度沒同時加 padding，也沒把兩者的
            量對齊）。
          - 直欄模式：width = 基準 104px + safe-area-inset-right；同時
            pr-[calc(0.5rem+env(...))] 把安全區從內容寬度扣掉、推到最右邊，
            兩者相減後內容寬度固定是 104-8(pl-2)-8(pr 基準)=88px，
            足夠放下「清除」按鈕（量得約 76px）＋左右內距，不會左右溢出。 */}
      <div
        ref={toolbarRef}
        className={cn(
          "flex shrink-0 items-center justify-center",
          vertical
            ? "h-full pl-2 pr-[calc(0.5rem+env(safe-area-inset-right))]"
            : "w-full pb-[env(safe-area-inset-bottom)]",
        )}
        style={
          vertical
            ? { width: `calc(${VERTICAL_TOOLBAR_WIDTH}px + env(safe-area-inset-right))` }
            : { height: `calc(${HORIZONTAL_TOOLBAR_HEIGHT}px + env(safe-area-inset-bottom))` }
        }
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
