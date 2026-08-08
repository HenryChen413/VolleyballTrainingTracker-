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
  return render(
    <QueryClientProvider client={queryClient}>
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
