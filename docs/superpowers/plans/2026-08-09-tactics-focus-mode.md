# 戰術板專注模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓戰術板在手機與 iPad 上能一眼看到完整場地、用拇指就能操作，並把畫線簡化成「直接畫、不用先選線種」。

**Architecture:** 新增全螢幕 overlay「專注模式」，場地依可用空間等比置中；全螢幕邏輯自 `ScoreBoard.tsx` 抽成共用 hook（含 iPhone Safari 靜默失效的特性偵測與 CSS 假全螢幕退路）。畫線收斂為單一直線工具、預設加箭頭，移除曲線相關程式碼。線條命中區改由場地實際寬度回推，確保觸控目標達 44px。專注模式與一般模式共用同一份 `useTacticsDrawings` / `useTacticsBoard` 草稿狀態，進出不搬移資料。

**Tech Stack:** React 19 + TypeScript + Vite、Tailwind、zustand（toast store）、vitest + jsdom + @testing-library/react

設計文件：`docs/superpowers/specs/2026-08-09-tactics-focus-mode-design.md`

## Global Constraints

- 所有註解、UI 文字、commit message 一律**繁體中文**
- 前端目錄為 `volleyballtrainingtracker.client`，所有指令在該目錄下執行
- 交付前必須跑 `npm test`（vitest），不能只靠 `tsc` 與 `eslint`
- 測試檔命名慣例：`src/lib/xxx.ts` 配 `src/lib/xxx.test.ts`
- 引號風格**沿用被修改檔案的既有風格**：`src/lib/*.ts` 與 `src/stores/*` 用單引號，`src/components/tactics/*` 用雙引號
- 座標系統：`COURT_VIEW = { w: 1000, h: 1900 }`，所有點以 0~1 正規化值儲存
- 觸控目標最小 44px
- 不改動 `xl:` 並排斷點與一般模式版面
- 不實作 Undo/Redo、不實作後端儲存、不處理多分頁草稿同步

## 與設計文件的一處偏離（已驗證）

設計文件決策 8 寫「須驗證 `Toaster` 是否支援帶動作按鈕的 toast，若不支援則退回確認框」。

**驗證結果：不支援。** `ToastItem`（`src/lib/toast.ts:5-11`）只有 `id / tone / title / description / duration`，`ToastCard` 只渲染一顆關閉鈕。

**但 `toast.ts` 是乾淨的 zustand store，加一個選用 action 約 15 行即可**，明顯優於退回確認框（確認框只能防誤觸，復原連「確認後才後悔」都救得回來，這正是使用者採納此決策的理由）。故 Task 2 擴充 toast store，不走退回路線。

---

### Task 1: 抽出 `useFullscreen` hook

把 `ScoreBoard.tsx` 內綁死的全螢幕邏輯抽成共用 hook，記分板改用它。**純重構，行為不變**，並讓原本無法測試的邏輯有測試。

**Files:**
- Create: `volleyballtrainingtracker.client/src/lib/useFullscreen.ts`
- Test: `volleyballtrainingtracker.client/src/lib/useFullscreen.test.ts`
- Modify: `volleyballtrainingtracker.client/src/components/scoreboard/ScoreBoard.tsx:1-95`（移除 type 定義、兩個 state、useEffect、toggleFullscreen）與 `:107-113`（改用 hook 回傳值）

**Interfaces:**
- Produces:
  ```ts
  export interface UseFullscreenResult<T extends HTMLElement> {
    ref: React.RefObject<T | null>;
    isFullscreen: boolean;
    cssFullscreen: boolean;   // true = 走 CSS 假全螢幕，呼叫端需自行套 fixed inset-0 樣式
    toggle: () => void;
    exit: () => void;
  }
  export function useFullscreen<T extends HTMLElement>(): UseFullscreenResult<T>;
  ```

- [ ] **Step 1: 寫失敗的測試**

建立 `src/lib/useFullscreen.test.ts`：

```ts
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFullscreen } from './useFullscreen';

/** jsdom 未實作 Fullscreen API，逐項以 defineProperty 模擬 */
function stubFullscreen(opts: {
  enabled: boolean;
  request?: () => Promise<void>;
}) {
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    value: opts.enabled,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    writable: true,
    value: null,
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: opts.request ?? (() => Promise.resolve()),
  });
}

describe('useFullscreen', () => {
  beforeEach(() => {
    stubFullscreen({ enabled: true });
  });

  it('原生 API 可用時呼叫 requestFullscreen，不進入 CSS 假全螢幕', () => {
    const request = vi.fn(() => Promise.resolve());
    stubFullscreen({ enabled: true, request });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    const el = document.createElement('div');
    document.body.appendChild(el);
    result.current.ref.current = el;

    act(() => result.current.toggle());

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.cssFullscreen).toBe(false);
  });

  it('fullscreenEnabled 為 false 時退回 CSS 假全螢幕', () => {
    stubFullscreen({ enabled: false });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    result.current.ref.current = document.createElement('div');

    act(() => result.current.toggle());

    expect(result.current.cssFullscreen).toBe(true);
    expect(result.current.isFullscreen).toBe(true);
  });

  it('原生請求被拒時退回 CSS 假全螢幕', async () => {
    stubFullscreen({ enabled: true, request: () => Promise.reject(new Error('denied')) });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    result.current.ref.current = document.createElement('div');

    await act(async () => {
      result.current.toggle();
      await Promise.resolve();
    });

    expect(result.current.cssFullscreen).toBe(true);
  });

  it('fullscreenchange 事件會同步狀態（系統手勢或 ESC 退出）', () => {
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    const el = document.createElement('div');

    act(() => {
      (document as { fullscreenElement: Element | null }).fullscreenElement = el;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.isFullscreen).toBe(true);

    act(() => {
      (document as { fullscreenElement: Element | null }).fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.isFullscreen).toBe(false);
  });

  it('CSS 假全螢幕下按 ESC 會退出', () => {
    stubFullscreen({ enabled: false });

    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    result.current.ref.current = document.createElement('div');

    act(() => result.current.toggle());
    expect(result.current.cssFullscreen).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.cssFullscreen).toBe(false);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- src/lib/useFullscreen.test.ts`
Expected: FAIL，訊息為找不到模組 `./useFullscreen`

- [ ] **Step 3: 實作 hook**

建立 `src/lib/useFullscreen.ts`：

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * iOS Safari 的 Fullscreen API 支援度補丁型別：
 * - iPhone：完全不支援（requestFullscreen 為 undefined，或存在但靜默無效）
 * - 舊版 iPad：只認 webkit 前綴
 */
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
  webkitFullscreenEnabled?: boolean;
};

export interface UseFullscreenResult<T extends HTMLElement> {
  /** 掛到要全螢幕的元素上 */
  ref: React.RefObject<T | null>;
  /** 原生或 CSS 假全螢幕，任一成立 */
  isFullscreen: boolean;
  /** true 表示走 CSS 假全螢幕，呼叫端需自行套 fixed inset-0 之類的樣式 */
  cssFullscreen: boolean;
  toggle: () => void;
  exit: () => void;
}

/**
 * 全螢幕切換：原生 Fullscreen API 優先，不支援或被拒時退回 CSS 假全螢幕。
 *
 * iPhone Safari 會暴露 webkitRequestFullscreen 但呼叫後靜默無效，
 * 因此不能只看函式是否存在，必須以 fullscreenEnabled 特性偵測把關。
 */
export function useFullscreen<T extends HTMLElement>(): UseFullscreenResult<T> {
  const ref = useRef<T | null>(null);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  // 同步原生全螢幕狀態（含 ESC／系統手勢退出），webkit 前綴事件給舊 iPad
  useEffect(() => {
    const doc = document as FullscreenDocument;
    const sync = () =>
      setNativeFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  // CSS 假全螢幕沒有瀏覽器內建的 ESC 行為，自己補
  useEffect(() => {
    if (!cssFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCssFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cssFullscreen]);

  const exit = useCallback(() => {
    const doc = document as FullscreenDocument;
    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
      return;
    }
    setCssFullscreen(false);
  }, []);

  const toggle = useCallback(() => {
    const doc = document as FullscreenDocument;
    const el = ref.current as FullscreenElement | null;
    if (!el) return;

    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }

    const supported = document.fullscreenEnabled || doc.webkitFullscreenEnabled === true;
    if (!supported) {
      setCssFullscreen(true);
      return;
    }
    try {
      if (el.requestFullscreen) {
        // 原生請求可能被拒（權限／嵌入環境），失敗時退回 CSS 全螢幕
        el.requestFullscreen().catch(() => setCssFullscreen(true));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        setCssFullscreen(true);
      }
    } catch {
      setCssFullscreen(true);
    }
  }, [cssFullscreen]);

  return {
    ref,
    isFullscreen: nativeFullscreen || cssFullscreen,
    cssFullscreen,
    toggle,
    exit,
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- src/lib/useFullscreen.test.ts`
Expected: PASS，5 個測試全過

- [ ] **Step 5: 記分板改用 hook**

修改 `src/components/scoreboard/ScoreBoard.tsx`：

1. 刪除檔案開頭的 `FullscreenElement` / `FullscreenDocument` type 定義（第 9-21 行）
2. 刪除 `boardRef`、`cssFullscreen`、`nativeFullscreen`、`isFullscreen` 四個宣告（第 44-48 行）與整個 `useEffect`（第 50-61 行）、整個 `toggleFullscreen`（第 63-95 行）
3. 改為：

```tsx
const {
  ref: boardRef,
  isFullscreen,
  cssFullscreen,
  toggle: toggleFullscreen,
} = useFullscreen<HTMLDivElement>();
```

4. import 改為 `import { useFullscreen } from '@/lib/useFullscreen';`，並移除已不需要的 `useEffect`、`useRef`、`useState` import（確認檔案其他地方沒在用再刪）
5. `isFullscreen` 目前用於切換 `Expand` / `Shrink` 圖示，`cssFullscreen` 用於 `:112` 的 className 條件 —— **兩者行為維持不變**

- [ ] **Step 6: 執行完整測試與型別檢查**

Run: `npm test`
Expected: PASS，全部測試檔通過（原有 8 files / 62 tests + 新增的 useFullscreen 5 tests）

Run: `npx tsc -b`
Expected: 無輸出（exit 0）

Run: `npx eslint src/lib/useFullscreen.ts src/lib/useFullscreen.test.ts src/components/scoreboard/ScoreBoard.tsx`
Expected: 無輸出

- [ ] **Step 7: 手動確認記分板沒壞**

Run: `npm run dev`，開記分板頁面，按全螢幕鈕確認仍能進出（桌機瀏覽器走原生路徑）。

- [ ] **Step 8: Commit**

```bash
git add src/lib/useFullscreen.ts src/lib/useFullscreen.test.ts src/components/scoreboard/ScoreBoard.tsx
git commit -m "抽出 useFullscreen hook，記分板改用共用實作

原本全螢幕邏輯綁死在 ScoreBoard 元件內無法測試。抽成 src/lib/useFullscreen.ts
後行為完全不變，並補上 5 個測試涵蓋原生路徑、fullscreenEnabled 特性偵測退回
CSS 假全螢幕、原生請求被拒退回、fullscreenchange 同步、CSS 模式下 ESC 退出。

戰術板專注模式將共用此 hook。"
```

---

### Task 2: toast 支援動作按鈕

專注模式的「清除全部」要改成「直接清除 ＋ 可復原提示」，需要 toast 帶一顆動作鈕。

**Files:**
- Modify: `volleyballtrainingtracker.client/src/lib/toast.ts:5-11`（`ToastItem` 加 `action`）與 `:32-42`（新增 `toast.undoable`）
- Modify: `volleyballtrainingtracker.client/src/components/Toaster.tsx:29-53`（`ToastCard` 渲染動作鈕）
- Test: `volleyballtrainingtracker.client/src/lib/toast.test.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  ```ts
  export interface ToastAction { label: string; onClick: () => void; }
  export interface ToastItem { /* 既有欄位 */ action?: ToastAction; }
  // 推一則帶「復原」鈕的提示，點下後執行 onUndo 並關閉該則
  toast.undoable(title: string, actionLabel: string, onUndo: () => void, description?: string): number;
  ```

- [ ] **Step 1: 寫失敗的測試**

建立 `src/lib/toast.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, useToastStore } from './toast';

describe('toast store', () => {
  beforeEach(() => {
    useToastStore.setState({ items: [] });
  });

  it('undoable 會推一則帶動作的提示', () => {
    const onUndo = vi.fn();
    toast.undoable('已清除 5 條', '復原', onUndo);

    const [item] = useToastStore.getState().items;
    expect(item.title).toBe('已清除 5 條');
    expect(item.action?.label).toBe('復原');
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('觸發動作會執行 callback 並關閉該則提示', () => {
    const onUndo = vi.fn();
    toast.undoable('已清除 5 條', '復原', onUndo);

    const [item] = useToastStore.getState().items;
    item.action?.onClick();

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().items).toHaveLength(0);
  });

  it('一般的 toast 不帶動作', () => {
    toast.success('存檔完成');
    expect(useToastStore.getState().items[0].action).toBeUndefined();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- src/lib/toast.test.ts`
Expected: FAIL，`toast.undoable is not a function`

- [ ] **Step 3: 擴充 store**

修改 `src/lib/toast.ts`：

在 `ToastTone` 之後加入：

```ts
export interface ToastAction {
  label: string;
  onClick: () => void;
}
```

`ToastItem` 加一個欄位：

```ts
export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
  /** 選用的動作鈕（如「復原」）；點下後由呼叫端負責關閉 */
  action?: ToastAction;
}
```

`toast` 物件加入（放在 `dismiss` 之前）：

```ts
  /**
   * 推一則可復原的提示：點「復原」執行 onUndo 並立即關閉該則。
   * 用於「先動作、後補救」的流程，取代每次都要按確認的對話框。
   */
  undoable: (title: string, actionLabel: string, onUndo: () => void, description?: string) => {
    const store = useToastStore.getState();
    const id = store.push({
      tone: 'info',
      title,
      description,
      action: {
        label: actionLabel,
        onClick: () => {
          onUndo();
          useToastStore.getState().dismiss(id);
        },
      },
    });
    return id;
  },
```

> 注意：`push` 回傳的 `id` 在 `onClick` 建立時尚未指派，但 `onClick` 是在使用者點擊時才執行，屆時 `id` 已完成賦值 —— 這是刻意利用閉包，不要改成先算 id 再 push。

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- src/lib/toast.test.ts`
Expected: PASS，3 個測試全過

- [ ] **Step 5: Toaster 渲染動作鈕**

修改 `src/components/Toaster.tsx`，在 `ToastCard` 的內容區塊（第 38-43 行的 `div`）之後、關閉鈕之前插入：

```tsx
      {item.action && (
        <button
          type="button"
          onClick={item.action.onClick}
          className="shrink-0 self-center rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent transition"
        >
          {item.action.label}
        </button>
      )}
```

- [ ] **Step 6: 驗證與 commit**

Run: `npm test`
Expected: PASS

Run: `npx tsc -b`
Expected: 無輸出

```bash
git add src/lib/toast.ts src/lib/toast.test.ts src/components/Toaster.tsx
git commit -m "toast 支援選用的動作按鈕與 undoable 捷徑

新增 ToastAction 型別與 toast.undoable()，讓「先動作、後補救」的流程
可以取代每次都要按確認的對話框。戰術板專注模式的「清除全部」會用到。"
```

---

### Task 3: 新增命中區換算純函式

**純新增，不動既有行為**，先把換算邏輯與測試就位，Task 4 才接上元件。

**Files:**
- Modify: `volleyballtrainingtracker.client/src/lib/drawing.ts`（檔尾新增）
- Modify: `volleyballtrainingtracker.client/src/lib/drawing.test.ts`（新增 describe 區塊）

**Interfaces:**
- Consumes: `COURT_VIEW`（來自 `@/lib/court`，`drawing.ts` 已 import）
- Produces:
  ```ts
  export const MIN_TOUCH_TARGET_PX: number;               // 44
  export function handleHitRadiusFor(courtWidthPx: number): number;  // 端點命中「半徑」，viewBox 單位
  export function hitStrokeWidthFor(courtWidthPx: number): number;   // 線條命中「描邊寬度」，viewBox 單位
  ```

- [ ] **Step 1: 寫失敗的測試**

在 `src/lib/drawing.test.ts` 的 import 加入 `handleHitRadiusFor, hitStrokeWidthFor, MIN_TOUCH_TARGET_PX`，並在檔尾新增：

```ts
describe('命中區換算', () => {
  /** viewBox 單位換算回螢幕 px */
  const toPx = (viewUnits: number, courtWidthPx: number) => (viewUnits * courtWidthPx) / 1000;

  it('端點命中直徑在各種場地寬度下都不小於 44px', () => {
    for (const widthPx of [295, 308, 342, 368, 560]) {
      const r = handleHitRadiusFor(widthPx);
      expect(toPx(r, widthPx) * 2).toBeCloseTo(MIN_TOUCH_TARGET_PX);
    }
  });

  it('線條命中寬度在各種場地寬度下都不小於 44px', () => {
    for (const widthPx of [295, 308, 342, 368, 560]) {
      const w = hitStrokeWidthFor(widthPx);
      expect(toPx(w, widthPx)).toBeCloseTo(MIN_TOUCH_TARGET_PX);
    }
  });

  it('場地越小，換算出的 viewBox 命中值越大', () => {
    expect(handleHitRadiusFor(295)).toBeGreaterThan(handleHitRadiusFor(560));
  });

  it('尚未量到版面（0 或 NaN）時回傳保底值，不產生 Infinity', () => {
    expect(handleHitRadiusFor(0)).toBe(36);
    expect(hitStrokeWidthFor(0)).toBe(28);
    expect(handleHitRadiusFor(Number.NaN)).toBe(36);
    expect(hitStrokeWidthFor(Number.NaN)).toBe(28);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- src/lib/drawing.test.ts`
Expected: FAIL，`handleHitRadiusFor is not a function`

- [ ] **Step 3: 實作換算函式**

在 `src/lib/drawing.ts` 檔尾加入：

```ts
/** 觸控目標最小尺寸（px）；Apple HIG 與 Material 的共同建議值 */
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * 端點控制點的命中半徑（viewBox 單位）。
 * 命中區必須以「螢幕上的實際大小」為準 —— 固定的 viewBox 值在小場地上
 * 會縮成十幾 px，手指點不到。故由場地實際像素寬回推。
 * 場地尚未量到（0 / NaN）時回傳改動前的固定值當保底，避免 Infinity。
 */
export function handleHitRadiusFor(courtWidthPx: number): number {
  if (!(courtWidthPx > 0)) return 36;
  return (MIN_TOUCH_TARGET_PX / 2) * (COURT_VIEW.w / courtWidthPx);
}

/**
 * 線條隱形命中區的描邊寬度（viewBox 單位）。
 * 與端點不同，描邊寬度即完整命中寬度（不是半徑），故不除以 2。
 */
export function hitStrokeWidthFor(courtWidthPx: number): number {
  if (!(courtWidthPx > 0)) return 28;
  return MIN_TOUCH_TARGET_PX * (COURT_VIEW.w / courtWidthPx);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- src/lib/drawing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/drawing.ts src/lib/drawing.test.ts
git commit -m "新增命中區換算函式，觸控目標改以螢幕實際大小為準

原本 HANDLE_HIT_RADIUS / HIT_STROKE_WIDTH 是寫死的 viewBox 單位，
場地 295px 寬時換算到螢幕只有 21px 直徑與 8px 寬，遠低於 44px 觸控建議值。
本次僅新增純函式與測試，接上元件在下一個 commit。"
```

---

### Task 4: 畫線收斂為單一直線工具

移除曲線（freehand），三個畫線工具合併成一個「畫」，並接上 Task 3 的動態命中區。
**lib 與三個元件必須同一個 commit 改完**，否則 TypeScript 編不過。

**Files:**
- Modify: `volleyballtrainingtracker.client/src/lib/drawing.ts`（`DrawingKind`、`drawingPathD`、刪 `simplifyPoints`）
- Modify: `volleyballtrainingtracker.client/src/lib/drawing.test.ts`（刪 `simplifyPoints` 的 describe）
- Modify: `volleyballtrainingtracker.client/src/components/tactics/VolleyballCourt.tsx`
- Modify: `volleyballtrainingtracker.client/src/components/tactics/DrawingLayer.tsx`
- Modify: `volleyballtrainingtracker.client/src/components/tactics/DrawingToolbar.tsx`

**Interfaces:**
- Consumes: `handleHitRadiusFor`、`hitStrokeWidthFor`（Task 3）
- Produces:
  ```ts
  export type DrawingKind = 'line' | 'arrow';
  export type DrawingTool = 'select' | 'draw' | 'eraser';
  // DrawingLayer 新增兩個必填 props
  interface DrawingLayerProps { handleHitRadius: number; hitStrokeWidth: number; /* 其餘不變 */ }
  // VolleyballCourt 新增一個必填 prop
  interface VolleyballCourtProps { arrowEnabled: boolean; /* 其餘不變 */ }
  ```

- [ ] **Step 1: 更新 `drawing.ts` 的型別與路徑產生**

`DrawingKind` 改為：

```ts
export type DrawingKind = 'line' | 'arrow';
/** 戰術板工具模式：選取（球員拖曳＋線條編輯）／畫線／橡皮擦 */
export type DrawingTool = 'select' | 'draw' | 'eraser';
```

`Drawing.points` 的註解改為：

```ts
  /** 固定為 [起點, 終點]；舊草稿可能含更多點，會以折線渲染 */
  points: DrawingPoint[];
```

`drawingPathD` 簡化為（移除貝茲分支）：

```ts
/**
 * 產生線身的 SVG path d 字串（viewBox 單位）。
 * 一律為折線；新線條固定兩點，舊草稿的多點曲線會退化成折線渲染（視覺幾乎相同）。
 */
export function drawingPathD(d: Drawing): string {
  const pts = d.points.map(toView);
  if (pts.length === 0) return '';
  return `M ${fmt(pts[0])}` + pts.slice(1).map((p) => ` L ${fmt(p)}`).join('');
}
```

刪除整個 `simplifyPoints` 函式（含其上方註解）。

- [ ] **Step 2: 更新 `drawing.test.ts`**

刪除整個 `describe('simplifyPoints', ...)` 區塊（含其三個 `it`），並從 import 移除 `simplifyPoints`。

在 `describe('drawingPathD', ...)` 內補一個測試：

```ts
  it('多點線條以折線渲染（舊草稿相容）', () => {
    const d: Drawing = {
      id: 'x',
      kind: 'line',
      color: '#ef4444',
      width: 5.4,
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
    };
    expect(drawingPathD(d)).toBe('M 0 0 L 500 950 L 1000 1900');
  });
```

> 若既有 `drawingPathD` 的 describe 名稱或 import 不同，依實際檔案調整；重點是這個斷言要存在。

- [ ] **Step 3: 執行測試確認 lib 層通過**

Run: `npm test -- src/lib/drawing.test.ts`
Expected: PASS

- [ ] **Step 4: `DrawingLayer.tsx` 接受命中區尺寸並修正端點判斷**

1. 刪除檔案開頭的 `HIT_STROKE_WIDTH`、`HANDLE_HIT_RADIUS` 兩個常數（保留 `HANDLE_RADIUS = 18`，那是「顯示」半徑不是命中半徑）
2. `Props` 加入：

```tsx
  /** 線條隱形命中區描邊寬度（viewBox 單位），由場地實際寬度換算 */
  hitStrokeWidth: number;
  /** 端點控制點命中半徑（viewBox 單位），由場地實際寬度換算 */
  handleHitRadius: number;
```

3. 函式參數解構加入 `hitStrokeWidth, handleHitRadius`
4. 命中區 `<path>` 的 `strokeWidth={HIT_STROKE_WIDTH}` 改為 `strokeWidth={hitStrokeWidth}`
5. 端點命中圓 `r={HANDLE_HIT_RADIUS}` 改為 `r={handleHitRadius}`
6. 端點控制點的顯示條件從 `d.kind !== "freehand"` 改為 `d.points.length === 2`：

```tsx
            {selected &&
              d.points.length === 2 &&
              d.points.map((p, i) => (
```

- [ ] **Step 5: `VolleyballCourt.tsx` 移除 freehand 並量測場地寬度**

1. import 從 `@/lib/drawing` 移除 `simplifyPoints`，加入 `handleHitRadiusFor, hitStrokeWidthFor`
2. 刪除常數 `MIN_SAMPLE_PX`（曲線取樣專用）
3. 刪除檔尾的 `polylineLengthPx` 函式（僅曲線 commit 用）
4. `Props` 加入：

```tsx
  /** 新線條是否加箭頭（樣式面板可關） */
  arrowEnabled: boolean;
```

5. 在元件內加入場地寬度量測（放在既有 state 宣告之後）：

```tsx
  // 命中區要以螢幕實際大小為準，需知道場地當前像素寬
  const [courtWidthPx, setCourtWidthPx] = useState(0);
  useEffect(() => {
    const el = courtRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setCourtWidthPx(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [courtRef]);
```

並確認檔案頂端有 import `useEffect`（原本只有 `useRef, useState`）。

6. `handleCanvasPointerDown` 的畫線分支改為：

```tsx
    if (tool === "draw") {
      setDraft({
        id: crypto.randomUUID(),
        kind: arrowEnabled ? "arrow" : "line",
        color: drawStyle.color,
        width: drawStyle.width,
        arrowSize: arrowEnabled ? arrowSizeFor(drawStyle.width) : undefined,
        points: [pt, pt],
      });
    }
```

7. `handleCanvasPointerMove` 的畫線分支簡化為（移除 freehand 判斷）：

```tsx
    if (!draft) return;
    setDraft({ ...draft, points: [draft.points[0], pt] });
```

8. `handleCanvasPointerUp` 簡化為：

```tsx
  const handleCanvasPointerUp = () => {
    if (tool === "eraser") {
      erasing.current = false;
      return;
    }
    if (!draft) return;
    const rect = courtRef.current?.getBoundingClientRect();
    setDraft(null);
    if (!rect) return;
    const [a, b] = draft.points;
    const lenPx = Math.hypot((b.x - a.x) * rect.width, (b.y - a.y) * rect.height);
    if (lenPx >= MIN_COMMIT_PX) onAddDrawing(draft);
  };
```

9. 傳給 `DrawingLayer` 的 props 加上：

```tsx
          hitStrokeWidth={hitStrokeWidthFor(courtWidthPx)}
          handleHitRadius={handleHitRadiusFor(courtWidthPx)}
```

- [ ] **Step 6: `DrawingToolbar.tsx` 收斂工具清單**

`TOOLS` 改為：

```tsx
const TOOLS: ReadonlyArray<{
  value: DrawingTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "select", label: "選取", icon: MousePointer2 },
  { value: "draw", label: "畫", icon: Pencil },
  { value: "eraser", label: "橡皮擦", icon: Eraser },
];
```

import 移除已不用的 `ArrowUpRight` 與 `Slash`。

- [ ] **Step 7: `TacticsBoard.tsx` 補上 `arrowEnabled`**

頁面暫時以固定值傳入（樣式面板的開關在 Task 5 才做）：

```tsx
              arrowEnabled
```

加在 `<VolleyballCourt ... />` 的 props 中。

- [ ] **Step 8: 全套驗證**

Run: `npm test`
Expected: PASS

Run: `npx tsc -b`
Expected: 無輸出。**若出現 `tool === "line"` 之類的殘留比對錯誤，表示還有 freehand/line/arrow 的舊分支沒清乾淨，逐一修正。**

Run: `npx eslint src/lib/drawing.ts src/components/tactics src/pages/TacticsBoard.tsx`
Expected: 無輸出

- [ ] **Step 9: 手動確認一般模式仍可畫線**

Run: `npm run dev`，進 `/tactics`，用「畫」工具拖曳應產生直箭頭，「選取」可點選與拖端點，橡皮擦可擦除。

- [ ] **Step 10: Commit**

```bash
git add src/lib/drawing.ts src/lib/drawing.test.ts src/components/tactics src/pages/TacticsBoard.tsx
git commit -m "畫線收斂為單一直線工具，命中區改為動態換算

依場邊即時說明的使用情境，三個畫線工具（直線／箭頭／曲線）合併成單一「畫」，
拖曳即產生直線並預設加箭頭，不需事先選擇線種。移除曲線相關的 simplifyPoints、
貝茲平滑分支與取樣邏輯；DrawingKind 縮為 line | arrow。

舊草稿不會壞：drawingPathD 對多點資料以折線渲染，視覺幾乎相同，
端點控制點的判斷改為 points.length === 2 同時涵蓋新舊資料。

命中區接上 handleHitRadiusFor / hitStrokeWidthFor，由 ResizeObserver 量到的
場地實際寬度換算，確保螢幕上的觸控目標不小於 44px。"
```

---

### Task 5: `FocusModeToolbar` 元件

**Files:**
- Create: `volleyballtrainingtracker.client/src/components/tactics/FocusModeToolbar.tsx`

**Interfaces:**
- Consumes: `DrawingTool`（Task 4）、`DrawingStyle`（`./useTacticsDrawings`）、`DRAWING_COLORS` / `DRAWING_WIDTHS`（`@/lib/drawing`）
- Produces:
  ```tsx
  interface FocusModeToolbarProps {
    orientation: 'horizontal' | 'vertical';
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
  export default function FocusModeToolbar(props: FocusModeToolbarProps): JSX.Element;
  ```

- [ ] **Step 1: 建立元件**

```tsx
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
                  "h-9 w-9 rounded-full border border-border/60",
                  style.color === c && "ring-2 ring-ring ring-offset-2 ring-offset-card",
                )}
                style={{ backgroundColor: c }}
                onClick={() => onStyleChange({ color: c })}
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
                onClick={() => onStyleChange({ width: w.value })}
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
```

- [ ] **Step 2: 型別與 lint 檢查**

Run: `npx tsc -b`
Expected: 無輸出（此時元件尚未被使用，但型別要正確）

Run: `npx eslint src/components/tactics/FocusModeToolbar.tsx`
Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add src/components/tactics/FocusModeToolbar.tsx
git commit -m "新增專注模式工具列元件

常駐只放場邊高頻動作（畫／選取／橡皮擦／清除全部／刪除選取），
低頻的顏色、粗細、箭頭開關收進樣式面板。支援橫向（手機置底）與
直向（寬螢幕側欄）兩種排列，所有按鈕觸控目標 >= 44px。"
```

---

### Task 6: `TacticsFocusMode` overlay 容器

**Files:**
- Create: `volleyballtrainingtracker.client/src/components/tactics/TacticsFocusMode.tsx`
- Modify: `volleyballtrainingtracker.client/src/lib/court.ts`（新增 `fitCourtSize`）
- Modify: `volleyballtrainingtracker.client/src/lib/court.test.ts`（新增測試）

**Interfaces:**
- Consumes: `useFullscreen`（Task 1）、`FocusModeToolbar`（Task 5）、`VolleyballCourt`（Task 4）
- Produces:
  ```ts
  // court.ts
  export function fitCourtSize(availW: number, availH: number): { width: number; height: number };
  ```
  ```tsx
  // TacticsFocusMode 的 props 為 VolleyballCourt 全部 props 加上：
  interface ExtraProps {
    onExit: () => void;
    cssFullscreen: boolean;
    // 及 FocusModeToolbar 需要的 style / tool / arrow / clear 相關 props
  }
  ```

- [ ] **Step 1: 寫 `fitCourtSize` 的失敗測試**

在 `src/lib/court.test.ts` 檔尾加入（並在 import 補上 `fitCourtSize`）：

```ts
describe('fitCourtSize', () => {
  it('高度受限時以高度為準，維持 10:19 比例', () => {
    const { width, height } = fitCourtSize(400, 600);
    expect(height).toBeCloseTo(600);
    expect(width).toBeCloseTo((600 * 10) / 19);
    expect(height / width).toBeCloseTo(1.9);
  });

  it('寬度受限時以寬度為準，維持 10:19 比例', () => {
    const { width, height } = fitCourtSize(200, 900);
    expect(width).toBeCloseTo(200);
    expect(height).toBeCloseTo(380);
  });

  it('結果永遠塞得進可用空間', () => {
    for (const [w, h] of [[375, 650], [768, 1000], [1024, 700], [300, 300]]) {
      const r = fitCourtSize(w, h);
      expect(r.width).toBeLessThanOrEqual(w + 0.001);
      expect(r.height).toBeLessThanOrEqual(h + 0.001);
    }
  });

  it('可用空間為 0 時回傳 0，不產生 NaN', () => {
    expect(fitCourtSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- src/lib/court.test.ts`
Expected: FAIL，`fitCourtSize is not a function`

- [ ] **Step 3: 實作 `fitCourtSize`**

在 `src/lib/court.ts` 檔尾加入：

```ts
/**
 * 依可用空間算出「完整可見」的場地尺寸（等比 10:19）。
 * 以 JS 計算而非交給 CSS aspect-ratio ＋ 雙向 max 約束，
 * 是為了在各瀏覽器得到完全一致且可測試的結果。
 */
export function fitCourtSize(
  availW: number,
  availH: number,
): { width: number; height: number } {
  if (!(availW > 0) || !(availH > 0)) return { width: 0, height: 0 };
  const width = Math.min(availW, (availH * COURT_VIEW.w) / COURT_VIEW.h);
  return { width, height: (width * COURT_VIEW.h) / COURT_VIEW.w };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- src/lib/court.test.ts`
Expected: PASS

- [ ] **Step 5: 建立 overlay 元件**

建立 `src/components/tactics/TacticsFocusMode.tsx`：

```tsx
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
```

- [ ] **Step 6: 讓 `VolleyballCourt` 可接受外部尺寸**

`VolleyballCourt` 的根容器目前寫死 `mx-auto aspect-[10/19] w-full max-w-[560px]`，
在專注模式下外層已算好精確尺寸，需要讓它改為填滿父容器。

在 `VolleyballCourt` 的 `Props` 加入：

```tsx
  /** 覆寫根容器樣式；未提供時沿用一般模式的置中等比版面 */
  className?: string;
```

函式參數解構加入 `className`，根 `div` 的 className 改為：

```tsx
      className={cn(
        "relative select-none",
        className ?? "mx-auto aspect-[10/19] w-full max-w-[560px]",
      )}
```

確認檔案頂端已 import `cn`（`import { cn } from "@/lib/utils";`，原本就有）。

一般模式的 `TacticsBoard.tsx` 不傳 `className`，版面完全不變。

- [ ] **Step 7: 驗證**

Run: `npm test`
Expected: PASS

Run: `npx tsc -b`
Expected: 無輸出

Run: `npx eslint src/components/tactics src/lib/court.ts`
Expected: 無輸出

- [ ] **Step 8: Commit**

```bash
git add src/lib/court.ts src/lib/court.test.ts src/components/tactics/TacticsFocusMode.tsx src/components/tactics/VolleyballCourt.tsx
git commit -m "新增戰術板專注模式 overlay 容器

場地尺寸以 fitCourtSize 依可用空間計算（不交給 CSS aspect-ratio ＋ 雙向 max
約束，以取得跨瀏覽器一致且可測試的結果），確保整個場地永遠完整可見。
工具列在手機置底、寬螢幕（>= 768px）改為右側直欄，兩者皆不遮擋場地。

容器不持有任何草稿狀態，全部由呼叫端傳入，故進出專注模式不會遺失內容。"
```

---

### Task 7: 接進戰術板頁面

**Files:**
- Modify: `volleyballtrainingtracker.client/src/pages/TacticsBoard.tsx`

**Interfaces:**
- Consumes: `useFullscreen`（Task 1）、`toast.undoable`（Task 2）、`TacticsFocusMode`（Task 6）

- [ ] **Step 1: 加入狀態與進出控制**

在 `TacticsBoardPage` 內既有的 `useState` 之後加入：

```tsx
  const [arrowEnabled, setArrowEnabled] = useState(true);
  const focus = useFullscreen<HTMLDivElement>();
```

import 補上：

```tsx
import { Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/lib/useFullscreen";
import { toast } from "@/lib/toast";
import TacticsFocusMode from "@/components/tactics/TacticsFocusMode";
```

- [ ] **Step 2: 加入可復原的清除**

在 `handleToolChange` 之後加入：

```tsx
  // 專注模式的清除不跳確認框 —— 場邊一次說明要清很多次，
  // 改成先清、再給 3 秒的復原機會，保護力反而優於確認框。
  const handleClearDrawingsWithUndo = () => {
    const snapshot = drawingsBoard.drawings;
    if (snapshot.length === 0) return;
    drawingsBoard.clearDrawings();
    toast.undoable(`已清除 ${snapshot.length} 條戰術線`, "復原", () => {
      snapshot.forEach((d) => drawingsBoard.addDrawing(d));
    });
  };
```

- [ ] **Step 3: 進入鈕與 overlay 渲染**

在場地卡的 `CardTitle` 內、`TacticsToolbar` 之前加入進入鈕：

```tsx
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={focus.toggle}
                title="專注模式"
                aria-label="專注模式"
              >
                <Expand className="h-5 w-5" />
              </Button>
```

在元件 `return` 的最外層 `<div className="space-y-4">` **之前**插入專注模式的早退渲染：

```tsx
  if (focus.isFullscreen) {
    return (
      <div ref={focus.ref}>
        <TacticsFocusMode
          onExit={focus.exit}
          cssFullscreen={focus.cssFullscreen}
          courtPlayers={courtPlayers}
          courtRef={courtRef}
          rosterRef={rosterRef}
          onMovePlayer={board.movePlayer}
          onSwapPlayers={board.swapPlayers}
          onRemovePlayer={board.removePlayer}
          tool={tool}
          onToolChange={handleToolChange}
          drawings={drawingsBoard.drawings}
          drawStyle={drawingsBoard.style}
          onStyleChange={drawingsBoard.applyStyle}
          arrowEnabled={arrowEnabled}
          onArrowEnabledChange={setArrowEnabled}
          selectedDrawingId={selectedId}
          onAddDrawing={drawingsBoard.addDrawing}
          onUpdateDrawing={drawingsBoard.updateDrawing}
          onRemoveDrawing={removeDrawing}
          onSelectDrawing={drawingsBoard.selectDrawing}
          onClearAll={handleClearDrawingsWithUndo}
        />
      </div>
    );
  }
```

> `focus.ref` 必須掛在會被送進 `requestFullscreen()` 的元素上。
> 原生全螢幕時該 `div` 由瀏覽器放大，內層以 `h-dvh w-full` 填滿；
> CSS 假全螢幕時內層自帶 `fixed inset-0`。

- [ ] **Step 4: 一般模式的 `arrowEnabled` 改用 state**

把 Task 4 Step 7 暫時寫死的 `arrowEnabled` 改為 `arrowEnabled={arrowEnabled}`。

- [ ] **Step 5: 驗證**

Run: `npm test`
Expected: PASS

Run: `npx tsc -b`
Expected: 無輸出

Run: `npx eslint src/pages/TacticsBoard.tsx`
Expected: 無輸出

Run: `npm run build`
Expected: 建置成功

- [ ] **Step 6: 手動檢查清單（需真機，逐項打勾）**

Run: `npm run dev`，用手機／iPad 連同一網段測試。

- [ ] iPhone Safari：進入專注模式後整個場地可見，無需捲動
- [ ] iPhone Safari：網址列出現／收合時場地不跳動（`h-dvh` 生效）
- [ ] iPhone PWA 獨立視窗：同上
- [ ] iPad 直向／橫向：工具列在右側直欄，未遮住場地
- [ ] 從對方端線後拖曳到我方端線後，可一筆完成，中途不被中斷
- [ ] 端點控制點與線條在手指操作下可穩定命中
- [ ] 以系統手勢／ESC 退出全螢幕後，UI 正確回到一般模式
- [ ] 專注模式與一般模式之間切換，已畫的線與站位都保留
- [ ] 清除後 3 秒內按「復原」，線條完整回來
- [ ] 樣式面板可改色、改粗細、關閉箭頭，且關閉後畫出的是無箭頭線段

- [ ] **Step 7: Commit**

```bash
git add src/pages/TacticsBoard.tsx
git commit -m "戰術板接上專注模式

場地卡標題列新增進入鈕；專注模式下以早退渲染只顯示 overlay，
狀態仍來自同一組 useTacticsBoard / useTacticsDrawings，進出不遺失內容。

專注模式的清除改為先清除再給可復原提示（toast.undoable），
不跳確認框 —— 場邊一次說明要清除多次，確認框是明顯摩擦，
而復原連「確認後才後悔」都救得回來。"
```

---

## 完成後的整體驗證

```bash
cd volleyballtrainingtracker.client
npm test          # 全部測試通過
npx tsc -b        # 無型別錯誤
npm run lint      # 無 lint 錯誤
npm run build     # 正式建置成功
```

推送後確認 GitHub Actions 的「前端（lint / test / build）」與「後端（build / test）」皆為綠。

## 已知取捨（實作時不要「順手修好」）

- **繞過攔網手的弧線跑位畫不出來**，需以兩三條直線銜接 —— 使用者已確認可接受，不要為此保留或復活 freehand
- **專注模式不含名單區**，無法從板凳補人 —— 刻意設計，不要加回來
- **一般模式在 iPad 上場地仍過高**（`xl:` 斷點問題）—— 明確列為非目標，本次不處理
- **多分頁草稿仍會互相覆蓋** —— 使用者評估風險低，維持現狀
