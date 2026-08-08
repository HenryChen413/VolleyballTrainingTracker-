// TacticsFocusMode 版面計算的永久回歸測試。
//
// 背景：Task 6 開發過程中發現並修正了三輪版面缺陷（isolate 圖層隔離、
// cssFullscreen=false 缺少 relative 定位祖先、safe-area 扣減量與 CSS
// calc() 對不齊），每輪都用「驗證後即刪除」的暫時性測試佐證，因此正式
// 交付內容裡完全沒有留下自動化回歸保護。本檔把那些暫時性驗證轉為永久
// 測試，把 fitCourtSize 用到的三個實測值（shell / toolbar / safe-area）
// 全部用 mock 的 getBoundingClientRect 控制，斷言 availW / availH /
// size 的計算結果，以及退出鈕與 isolate 圖層隔離的 DOM 拓樸關係。
//
// 這裡驗證的是「JS 端計算邏輯」與「DOM 結構」，不是瀏覽器實際排版或
// env() 安全區的實際解析值——那需要真機或瀏覽器自動化才能驗證，本專案
// 目前的測試環境（jsdom）無法涵蓋，詳見 task-7-report.md。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import TacticsFocusMode from "./TacticsFocusMode";
import type { DrawingStyle } from "./useTacticsDrawings";
import type { CourtPlayer } from "@/lib/court";
import type { DrawingTool } from "@/lib/drawing";

/** 供 mock ResizeObserver 使用：只記錄 observe 過的元素，不主動觸發 callback
 *  （TacticsFocusMode 的 effect 在建立 ResizeObserver 前已呼叫過一次 update()，
 *  測試只需要那一次同步呼叫的結果，不需要模擬後續 resize 事件）。 */
class MockResizeObserver {
  observe() {
    /* no-op：測試只依賴 mount 時的同步 update() */
  }
  unobserve() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
}

/** 目前這次 render 要套用的矩形，依 className 特徵分派：
 *  - shell（最外層容器）：className 含 "bg-background"（唯一，VolleyballCourt 不會有這個 class）
 *  - toolbar 容器：className 含 "shrink-0"（唯一）
 *  - safe-area 探測元素：className 含 "opacity-0"（唯一）
 *  其餘元素（如 VolleyballCourt 內部量測 courtRef 用的節點）一律回傳 0，
 *  不影響本檔驗證範圍。 */
let shellRect = { width: 0, height: 0 };
let toolbarRect = { width: 0, height: 0 };
let safeBottomRect = { width: 0, height: 0 };

function stubRect(width: number, height: number): DOMRect {
  return {
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

beforeEach(() => {
  shellRect = { width: 0, height: 0 };
  toolbarRect = { width: 0, height: 0 };
  safeBottomRect = { width: 0, height: 0 };

  vi.stubGlobal("ResizeObserver", MockResizeObserver);

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    const cls = (this as HTMLElement).className || "";
    if (cls.includes("bg-background")) return stubRect(shellRect.width, shellRect.height);
    if (cls.includes("shrink-0")) return stubRect(toolbarRect.width, toolbarRect.height);
    if (cls.includes("opacity-0")) return stubRect(safeBottomRect.width, safeBottomRect.height);
    return stubRect(0, 0);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const noop = () => {
  /* 測試不驗證互動回呼，僅需滿足必填 props 型別 */
};

function renderFocusMode(overrides: { tool?: DrawingTool; cssFullscreen?: boolean } = {}) {
  const courtPlayers: CourtPlayer[] = [];
  const drawings: never[] = [];
  const drawStyle: DrawingStyle = { color: "#ef4444", width: 4 };

  return render(
    <TacticsFocusMode
      onExit={noop}
      cssFullscreen={overrides.cssFullscreen ?? false}
      courtPlayers={courtPlayers}
      courtRef={{ current: null }}
      rosterRef={{ current: null }}
      onMovePlayer={noop}
      onSwapPlayers={noop}
      onRemovePlayer={noop}
      tool={overrides.tool ?? "select"}
      onToolChange={noop}
      drawings={drawings}
      drawStyle={drawStyle}
      onStyleChange={noop}
      arrowEnabled
      onArrowEnabledChange={noop}
      selectedDrawingId={null}
      onAddDrawing={noop}
      onUpdateDrawing={noop}
      onRemoveDrawing={noop}
      onSelectDrawing={noop}
      onClearAll={noop}
    />,
  );
}

describe("TacticsFocusMode 版面計算", () => {
  it("置底模式（窄螢幕）：availH 扣工具列實測高度，availW 不扣減", () => {
    // 模擬瀏覽器已把 calc(68px + env(safe-area-inset-bottom)=34px) 解析成 102px
    shellRect = { width: 400, height: 800 };
    toolbarRect = { width: 0, height: 102 };
    safeBottomRect = { width: 0, height: 0 };

    const { container } = renderFocusMode();

    // availW = 400（置底模式不扣工具列寬度）；availH = 800 - 102 = 698
    // fitCourtSize(400, 698)：高度較吃緊 → width = 698 * 10 / 19，height = 698
    const sized = container.querySelector(".isolate > div") as HTMLDivElement;
    expect(sized).toBeTruthy();
    expect(sized.style.height).toBe("698px");
    expect(sized.style.width).toBe(`${(698 * 1000) / 1900}px`);
  });

  it("直欄模式（寬螢幕）：availW 扣工具列實測寬度，availH 扣安全區探測值", () => {
    shellRect = { width: 900, height: 500 };
    toolbarRect = { width: 104, height: 0 };
    safeBottomRect = { width: 0, height: 34 };

    const { container } = renderFocusMode();

    // vertical = 900 >= 768 → true
    // availW = 900 - 104 = 796；availH = 500 - 34 = 466
    // fitCourtSize(796, 466)：高度較吃緊 → width = 466 * 10 / 19，height = 466
    const sized = container.querySelector(".isolate > div") as HTMLDivElement;
    expect(sized.style.height).toBe("466px");
    expect(sized.style.width).toBe(`${(466 * 1000) / 1900}px`);
  });

  it("直欄門檻邊界：寬度剛好等於 768px 視為直欄（扣工具列寬度，不是置底扣高度）", () => {
    shellRect = { width: 768, height: 600 };
    toolbarRect = { width: 104, height: 68 };
    safeBottomRect = { width: 0, height: 0 };

    const { container } = renderFocusMode();

    // vertical = 768 >= 768 → true；availW = 768-104=664，availH = 600-0=600
    const sized = container.querySelector(".isolate > div") as HTMLDivElement;
    const expectedWidth = Math.min(664, (600 * 1000) / 1900);
    expect(sized.style.width).toBe(`${expectedWidth}px`);
  });

  it("cssFullscreen=false（原生全螢幕路徑）：shell 帶 relative 定位祖先，不殘留 fixed", () => {
    const { container } = renderFocusMode({ cssFullscreen: false });
    const shell = container.querySelector(".bg-background") as HTMLDivElement;
    const tokens = shell.className.split(/\s+/);

    // I-1 修正：cssFullscreen=false 分支仍需要 relative，否則退出鈕的
    // absolute 定位會一路往外找不確定的祖先，捲動偏移時座標跑掉。
    expect(tokens).toContain("relative");
    expect(tokens).not.toContain("fixed");
  });

  it("cssFullscreen=true（CSS 假全螢幕路徑）：shell 蓋滿視窗，relative 被 twMerge 去重、不含 w-screen", () => {
    const { container } = renderFocusMode({ cssFullscreen: true });
    const shell = container.querySelector(".bg-background") as HTMLDivElement;
    const tokens = shell.className.split(/\s+/);

    expect(tokens).toContain("fixed");
    expect(tokens).toContain("inset-0");
    expect(tokens).toContain("h-dvh");
    // M-1 修正：w-screen 在有傳統捲軸的桌機瀏覽器會裁掉直欄工具列右側，已移除。
    expect(tokens).not.toContain("w-screen");
    // cn()/tailwind-merge 對同一個 position 群組去重，後出現的 fixed 蓋過 relative，
    // 兩者不會同時殘留在 class list 裡。
    expect(tokens).not.toContain("relative");
  });

  it("isolate 圖層隔離：退出鈕不是 .isolate 容器的後代，畫線模式的 z-30 捕捉層在容器內", () => {
    shellRect = { width: 900, height: 500 };
    toolbarRect = { width: 104, height: 0 };
    safeBottomRect = { width: 0, height: 34 };

    const { container } = renderFocusMode({ tool: "draw" });

    const exitButton = container.querySelector('[aria-label="退出專注模式"]');
    const isolateEl = container.querySelector(".isolate");
    expect(exitButton).toBeTruthy();
    expect(isolateEl).toBeTruthy();
    expect(isolateEl?.contains(exitButton)).toBe(false);

    // size.width > 0（本測試給了足夠的可用空間）才會掛載 VolleyballCourt，
    // tool="draw" 時其內部會渲染 z-30 全覆蓋繪圖捕捉層。
    const captureLayer = container.querySelector(".z-30");
    expect(captureLayer).toBeTruthy();
    expect(isolateEl?.contains(captureLayer)).toBe(true);
  });
});
