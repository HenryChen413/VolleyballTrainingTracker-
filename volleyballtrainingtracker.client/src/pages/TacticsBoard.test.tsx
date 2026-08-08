// 戰術板專注模式進出整合測試（回歸 C-1）。
//
// C-1 缺陷：focusRef 原本只掛在「focusIsFullscreen 為真」的早退渲染分支
// 裡，初始渲染一定是一般模式（focusIsFullscreen === false），此時
// focusRef.current 是 null；點「專注模式」鈕呼叫 useFullscreen().toggle()
// 時，函式開頭 `if (!el) return;` 會直接短路，整個切換完全沒有發生——
// 專注模式永遠進不去，且四項靜態驗證（test/tsc/eslint/build）全部測不出
// 這個問題，因為它們都不會真的渲染＋點擊。
//
// 這裡用實際渲染 + fireEvent.click 重現「使用者點按鈕」的操作，斷言
// 退出鈕確實出現、再點退出後確實回到一般模式，作為這類「接線斷了但看似
// 全綠」缺陷的永久保險。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/Toaster";
import TacticsBoardPage from "./TacticsBoard";

vi.mock("@/api/players", async () => {
  const actual = await vi.importActual<typeof import("@/api/players")>("@/api/players");
  return {
    ...actual,
    playersApi: {
      ...actual.playersApi,
      list: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("@/api/matchLogs", async () => {
  const actual = await vi.importActual<typeof import("@/api/matchLogs")>("@/api/matchLogs");
  return {
    ...actual,
    matchEventsApi: {
      ...actual.matchEventsApi,
      list: vi.fn().mockResolvedValue([]),
    },
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // <Toaster /> 在正式環境是掛在 App.tsx 根層，與頁面是「同層兄弟」而非
  // 子元件（見 src/App.tsx）；這裡比照同樣的結構掛上去，
  // 這樣「清除→復原 toast」那類測試才測得到真實的 DOM 樹關係。
  return render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <TacticsBoardPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // useTacticsBoard / useTacticsDrawings 的草稿存在 localStorage，
  // 避免上一個測試檔案留下的資料影響本檔案的斷言。
  localStorage.clear();
});

describe("TacticsBoardPage 專注模式進出", () => {
  it("點『專注模式』鈕後出現退出鈕；再點退出鈕後回到一般模式", async () => {
    renderPage();

    // 一般模式：球員名單卡片可見
    expect(await screen.findByText("球員名單")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退出專注模式" })).not.toBeInTheDocument();

    const enterButton = screen.getByRole("button", { name: "專注模式" });
    fireEvent.click(enterButton);

    // jsdom 沒有原生 Fullscreen API 支援（document.fullscreenEnabled 為
    // undefined），useFullscreen 會退回 CSS 假全螢幕；但不論走哪條路徑，
    // isFullscreen 都應該變 true，退出鈕都應該出現——這正是 C-1 壞掉的地方。
    const exitButton = await screen.findByRole("button", { name: "退出專注模式" });
    expect(exitButton).toBeInTheDocument();

    // 專注模式不含名單區（刻意設計），球員名單卡片不應存在
    expect(screen.queryByText("球員名單")).not.toBeInTheDocument();

    fireEvent.click(exitButton);

    // 退出後應回到一般模式：名單卡重新出現、退出鈕消失
    expect(await screen.findByText("球員名單")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退出專注模式" })).not.toBeInTheDocument();
  });
});

describe("TacticsBoardPage 專注模式清除→復原 toast（回歸 C-1）", () => {
  it("按『清除』後，復原 toast 可見且『復原』鈕能救回被清除的戰術線", async () => {
    // C-1 缺陷：Toaster 原本固定掛在 App 根層的 document.body，z-[60]。
    // 戰術板專注模式的 overlay 走 CSS 假全螢幕時是 fixed inset-0 z-[100]
    // 的不透明底色（會蓋過 z-[60]）；走原生全螢幕時整個文件被瀏覽器提升
    // 到 top layer 之外（Toaster 根本畫不出來）。兩條路徑都會讓「清除
    // 全部」後唯一的復原入口完全不可見 —— 靜默破壞性操作。
    //
    // jsdom 沒有原生 Fullscreen API（document.fullscreenEnabled 是
    // undefined），因此測不出「原生全螢幕 top layer 遮蔽」這條路徑，
    // Toaster 的 portal 目標在這裡一定會退回 document.body；這部分只能
    // 真機（或有 Fullscreen API 的瀏覽器）驗證。這裡改為直接釘住「使用者
    // 可觀察到的行為」：清除後 toast 確實渲染、文案正確、且『復原』鈕
    // 點下去真的能救回線條 —— 這正是 C-1 要保護的核心使用者流程。

    // 預先塞一條戰術線草稿（sourceKey "all" 對應預設「全部球員」模式），
    // 讓一進入專注模式，工具列的「清除」按鈕就已經可見（drawingCount > 0）。
    localStorage.setItem(
      "vbtt-tactics-drawings",
      JSON.stringify({
        version: 1,
        boards: {
          all: [
            {
              id: "d1",
              kind: "arrow",
              color: "#ef4444",
              width: 5.4,
              points: [
                { x: 0.2, y: 0.2 },
                { x: 0.8, y: 0.8 },
              ],
            },
          ],
        },
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "專注模式" }));
    await screen.findByRole("button", { name: "退出專注模式" });

    const clearButton = await screen.findByRole("button", { name: "清除" });
    fireEvent.click(clearButton);

    // 清除後：drawingCount 歸零，「清除」鈕應暫時消失
    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();

    // 復原 toast 必須出現，且「復原」鈕必須存在、可點擊
    expect(await screen.findByText("已清除 1 條戰術線")).toBeInTheDocument();
    const undoButton = screen.getByRole("button", { name: "復原" });
    expect(undoButton).toBeInTheDocument();

    fireEvent.click(undoButton);

    // 按下復原後戰術線應救回：「清除」鈕重新出現（drawingCount > 0）
    expect(await screen.findByRole("button", { name: "清除" })).toBeInTheDocument();
  });
});
