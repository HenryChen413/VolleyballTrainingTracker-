# 戰術板專注模式 — 設計文件

- 日期：2026-08-09
- 範圍：`volleyballtrainingtracker.client` 前端，戰術板頁面（`/tactics`）
- 狀態：已與使用者確認，待轉實作計畫

## 背景

戰術板目前在行動裝置上難以使用。使用者的實際情境是**訓練與比賽當下的即時說明**：
在場邊快速畫出戰術給球員看，講完清掉再畫下一個。主要裝置為 iPad 與手機，
桌機網頁很少用。

### 實測數字（問題根因）

以 iPhone 375px 寬推算：

| 項目 | 值 |
|---|---|
| `main` 的 `px-4` 後寬度 | 343px |
| `CardContent` 的 `p-6` 後 → 場地寬 | 295px |
| `aspect-[10/19]` → 場地高 | 560px |
| 可見區（視窗 − 56px header − 約 64px BottomTabBar） | 約 520px |

**整個場地塞不進一個螢幕**，即使把標題、賽事選擇、工具列全部捲掉也一樣。
使用者需要從對方場區畫到我方場區（已確認需要完整全場，不能裁短），
等於要在看不到全貌的畫布上做跨越式拖曳；而畫線模式下場地是 `touch-none`，
拖曳中無法捲動。工具列全部位於場地上方，換色、切換工具、清除都要往回捲。

iPad 同樣受影響且更嚴重：CLAUDE.md 的並排規範以 `xl:`（1280px）為斷點，
iPad 直向 768px、橫向 1024px 都到不了，因此拿到與手機相同的垂直堆疊版面，
場地寬度吃到 `max-w-[560px]` 上限 → 高度 1064px，可見比例更低。

### 觸控目標過小

`DrawingLayer.tsx` 的命中區以 viewBox 單位寫死（`HANDLE_HIT_RADIUS = 36`、
`HIT_STROKE_WIDTH = 28`）。場地 295px 寬時換算到螢幕上：

| 目標 | 實際大小 | 觸控建議值 |
|---|---|---|
| 端點控制點 | 直徑 21px | 44px |
| 線條命中區 | 寬 8px | 44px |

這解釋了使用者回報的「選取不順」—— 不只是工具列距離問題。

## 目標

1. 在手機與 iPad 上，**完整場地一眼可見**，不需捲動
2. 常用控制項落在**拇指可及範圍**
3. 觸控目標達到 44px 標準
4. 畫線流程**不需要事先做選擇**

## 非目標

- 後端儲存戰術（Phase 2，本次不做）
- Undo/Redo（使用者明確表示不需要）
- 草稿的多分頁同步（使用者評估風險低，維持現狀）
- 修改 `xl:` 並排斷點本身（一般模式版面不動）

關於最後一項需說明：背景提到 iPad 因 `xl:`（1280px）斷點而拿到堆疊版面、場地高達 1064px，
本設計**不處理一般模式的這個問題**。理由是排陣（拖曳球員上場）並不需要一眼看到全場，
邊捲動邊排是可接受的；真正需要「整場同時可見」的是跨場區畫線，而那正由專注模式解決。
一般模式的斷點調整留作後續獨立議題，避免本次改動擴散到既有版面規範。

## 設計決策

### 1. 全螢幕實作：複用記分板既有邏輯

`components/scoreboard/ScoreBoard.tsx` 已有踩過坑的完整實作，抽成共用 hook
`src/lib/useFullscreen.ts`，戰術板與記分板共用。它處理三件事：

1. **原生 API 優先** — Android Chrome、桌機、新版 iPad 走 `requestFullscreen()`
2. **iPhone 陷阱** — iPhone Safari 會暴露 `webkitRequestFullscreen` 但呼叫後靜默無效，
   必須以 `fullscreenEnabled` 特性偵測把關，不能只看函式是否存在
3. **退路** — 不支援或請求被拒時退回 CSS 假全螢幕
   （`fixed inset-0 z-[100] h-dvh w-screen`；用 `h-dvh` 避開行動瀏覽器網址列造成的高度跳動）

同時監聽 `fullscreenchange` / `webkitfullscreenchange` 同步狀態，
使用者以 ESC 或系統手勢退出時 UI 不會卡在錯誤狀態。

抽成 hook 的附帶效益：記分板該段邏輯目前綁死在元件內無法測試，抽出後可測。

### 2. 進出方式

| 動作 | 方式 |
|---|---|
| 進入 | 場地卡標題列一顆 `Expand` 圖示鈕（沿用記分板圖示語彙） |
| 退出 | 角落 `Shrink` 鈕、ESC 鍵、系統手勢（原生全螢幕時） |

### 3. 專注模式的內容範圍

畫面上只有三樣東西：**場地、浮動工具列、退出鈕**。
頁面標題、賽事選擇、名單卡、AppLayout 的 header 與 BottomTabBar 全部被 overlay 蓋掉。

**刻意不含名單區** —— 專注模式下無法從板凳補人（場上球員仍可拖曳、交換、移出）。
理由：使用流程是先排好陣型再進專注模式講戰術；塞入名單會壓縮場地，與本設計目的相反。
要換人請先退出專注模式。

`TacticsToolbar` 的「已上場 X / Y」與「清空場地」同樣不進專注模式，
兩者都屬於排陣階段的功能，放入只會佔位置並增加誤觸風險。

### 4. 場地尺寸

以**可視高度為主約束**、等比置中：

| 裝置 | 專注模式場地 | 現況 |
|---|---|---|
| iPhone Safari | 約 308 × 586（扣掉底部工具列高度），全場可見 | 295 × 560，只看得到 520 |
| iPad 橫向 | 約 368 × 700，工具列在側邊不佔高度 | 560 × 1064，可見不到七成 |

### 5. 工具列擺放：以 `md:` 斷點切換

| 螢幕 | 工具列 | 場地 |
|---|---|---|
| 窄（手機） | 底部橫向膠囊列，**佔用高度、不遮場地** | 縮至可用高度，全場可見 |
| 寬（iPad 起） | 場地**右側**直欄 | 佔滿可視高度，完全不被遮 |

直欄取右側，與既有 `AddFab` 的右下角慣例一致；退出鈕置於左上角，與工具列分離避免誤觸。

靜態斷點即足夠，不需動態計算：iPad 直向 768px 時場地寬約 526px、旁邊剩 242px，
直欄放得下；iPhone 橫向視窗 812px 寬、場地僅 197px 寬，也正確落在寬版面。

手機採「保留空間」而非「浮在場地上」：浮動可多拿約 10% 場地面積，
代價是遮住我方場區底部（跑位路線終點）。快速使用情境下**可預期性優先於面積**。

### 6. 畫線簡化：全部是直線

三個畫線工具（直線／箭頭／曲線）合併成單一「畫」工具。
拖曳起點到終點即為一條直線，`draft` 永遠只有兩個點，不需事先選擇線條種類。

箭頭預設開啟（戰術線幾乎都有方向性），樣式面板提供開關可關成純線段。

**已知取捨**：繞過攔網手的弧線跑位無法直接畫出，需以兩三條直線銜接。
使用者已確認可接受。

跟著移除的程式碼（皆為曲線專用）：

| 位置 | 內容 |
|---|---|
| `lib/drawing.ts` | `simplifyPoints`（Douglas-Peucker）及其三個測試 |
| `lib/drawing.ts` | `drawingPathD` 的中點二次貝茲平滑分支 |
| `VolleyballCourt.tsx` | 取樣邏輯 `MIN_SAMPLE_PX` 與四處 freehand 分支 |
| `lib/drawing.ts` | `DrawingKind` 縮成 `"line" \| "arrow"` |

**舊草稿不會壞**：`drawingPathD` 移除貝茲分支後對所有點即 `M L L L…`，
既有曲線退化為折線渲染，視覺上幾乎相同，不需相容性程式碼。
`DrawingLayer` 的端點控制點判斷從 `kind !== "freehand"` 改為 `points.length === 2`，
同時涵蓋新舊資料。

### 7. 工具列內容

```
[畫] [選取] [橡皮擦]    [樣式▾] [清除全部]
```

- **常駐**：上列五顆，皆位於拇指可及範圍
- **「刪除選取」**：僅在有選取線條時出現，補在常駐列尾端
  （使用者回報選取微調為高頻動作，不可收納）
- **樣式面板**：6 個顏色、3 個粗細、箭頭開關

分層依據為使用者確認的頻率：高頻為「清除全部重畫」與「選取後微調或刪單一條」；
換色與換工具皆非高頻。

### 8. 清除全部改為可復原

一般模式維持現有的 SweetAlert 確認框。**專注模式改為直接清除 ＋ 3 秒內可復原的提示**
（「已清除 N 條 · 復原」）。

理由：場邊一次說明要清除多次，每次確認是明顯摩擦；且復原的保護力優於確認框
—— 確認框只能防誤觸，復原連「確認後才後悔」都救得回來。

**實作前須驗證** `components/Toaster.tsx` 是否支援帶動作按鈕的 toast；
若不支援則退回確認框，不另外造輪子。

### 9. 命中區改為跟隨場地縮放

`HANDLE_HIT_RADIUS` 與 `HIT_STROKE_WIDTH` 改由場地實際像素寬回推，
確保螢幕上的命中區不小於 44px：

```
每 viewBox 單位對應的螢幕 px = 場地實際寬px / 1000

HANDLE_HIT_RADIUS = (44 / 2) × 1000 / 場地實際寬px   // 直徑 44px → 半徑 22px
HIT_STROKE_WIDTH  =  44      × 1000 / 場地實際寬px   // 描邊寬度即完整命中寬度
```

兩者的基準不同（一個是半徑、一個是完整寬度），需分別換算；
場地寬度由 `courtRef` 的 `getBoundingClientRect()` 取得，隨視窗尺寸變動重算。

專注模式下場地變大本身即改善此問題，此修正讓一般模式一併受惠。

## 元件結構

```
src/lib/useFullscreen.ts          新增 — 從 ScoreBoard 抽出（記分板改用它）
src/components/tactics/
  TacticsFocusMode.tsx            新增 — overlay 容器：尺寸計算、工具列擺放、進出
  FocusModeToolbar.tsx            新增 — 五顆常駐按鈕 + 樣式面板
  VolleyballCourt.tsx             修改 — 移除 freehand 分支、命中區改比例換算
  DrawingToolbar.tsx              修改 — 一般模式工具列，同步移除曲線與直線
  DrawingLayer.tsx                修改 — 端點判斷改 points.length === 2
```

**職責邊界**：`TacticsFocusMode` 只負責版面（多大、擺哪、如何進出）。
畫線狀態仍全部來自 `useTacticsDrawings`，站位來自 `useTacticsBoard`
—— 專注模式與一般模式**共用同一份草稿**，進出不會遺失內容。
`VolleyballCourt` 的對外介面不變，只是被放進不同容器。

## 資料流

```
TacticsBoardPage
  ├─ useTacticsBoard(sourceKey, roster)      站位（既有，不動）
  ├─ useTacticsDrawings(sourceKey)           戰術線（既有，不動）
  ├─ useFullscreen()                         新增
  │
  ├─ 一般模式：MatchEventSelector + Card(場地) + Card(名單)
  └─ 專注模式：TacticsFocusMode
                 ├─ VolleyballCourt          同一組 props
                 └─ FocusModeToolbar
```

進出專注模式只切換渲染容器，不搬移或複製任何狀態。

## 錯誤處理與退路

| 情況 | 行為 |
|---|---|
| 原生 Fullscreen 不支援（iPhone Safari） | 退回 CSS 假全螢幕 |
| 原生 Fullscreen 請求被拒（權限、嵌入環境） | `catch` 後退回 CSS 假全螢幕 |
| 使用者以系統手勢／ESC 退出 | `fullscreenchange` 同步狀態，UI 正確回到一般模式 |
| Toaster 不支援動作按鈕 | 清除全部退回 SweetAlert 確認框 |
| localStorage 不可用 | 維持既有行為（靜默忽略，見兩個 hook 的 catch） |

## 測試策略

### 自動化（vitest）

沿用 `src/lib/xxx.ts` 配 `src/lib/xxx.test.ts` 的既有慣例：

- `useFullscreen`：原生可用時走原生路徑；`fullscreenEnabled` 為 false 時退回 CSS；
  `fullscreenchange` 事件能同步狀態
- 命中區換算：不同場地寬度下換算結果皆 ≥ 44px
- `drawing.ts`：移除 `simplifyPoints` 的三個測試；補上「所有新建線條皆為兩點」的斷言

### 手動檢查清單（需真機）

版面本身不寫自動化測試。實作完成後在真機逐項確認：

- [ ] iPhone Safari：進入專注模式後整個場地可見，無需捲動
- [ ] iPhone Safari：網址列出現／收合時場地不跳動（`h-dvh` 生效）
- [ ] iPhone PWA 獨立視窗：同上
- [ ] iPad 直向／橫向：工具列在側邊，未遮住場地
- [ ] 從對方端線後拖曳到我方端線後，可一筆完成，中途不被中斷
- [ ] 端點控制點與線條在手指操作下可穩定命中
- [ ] 以系統手勢退出全螢幕後，UI 正確回到一般模式
- [ ] 專注模式與一般模式之間切換，已畫的線與站位都保留

## 待實作時驗證的假設

1. `components/Toaster.tsx` 是否支援帶動作按鈕的 toast（影響決策 8）
2. 場地等比置中在 `aspect-ratio` ＋ 雙向 max 約束下的實際行為，
   必要時改以 ResizeObserver 計算尺寸
