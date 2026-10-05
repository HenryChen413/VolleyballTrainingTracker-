// 比賽紀錄編輯頁：出賽名單要能顯示畢業／離隊的學姊。
//
// 原本名單只撈現役球員，編輯舊賽事時已畢業的學姊不會出現在畫面上，
// 卻仍留在 selectedPlayers 裡（人數對不上、也無法移除）；補登舊比賽時
// 也選不到已畢業的學姊。這裡用實際渲染 + 點擊驗證修正後的行為。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { matchEventsApi, type MatchEventDetail } from "@/api/matchLogs";
import { playersApi, PLAYER_STATUS, MEMBER_TYPE, type Player } from "@/api/players";
import { PERM, useAuthStore } from "@/stores/authStore";
import MatchLogEditPage from "./MatchLogEdit";

vi.mock("@/lib/swal", () => ({
  confirmAction: vi.fn().mockResolvedValue({ isConfirmed: true }),
  showError: vi.fn(),
  showSuccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/api/players", async () => {
  const actual = await vi.importActual<typeof import("@/api/players")>("@/api/players");
  return { ...actual, playersApi: { ...actual.playersApi, list: vi.fn() } };
});

vi.mock("@/api/matchLogs", async () => {
  const actual = await vi.importActual<typeof import("@/api/matchLogs")>("@/api/matchLogs");
  return {
    ...actual,
    matchEventsApi: {
      ...actual.matchEventsApi,
      get: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
  };
});

function makePlayer(id: number, name: string, isActive: Player["isActive"]): Player {
  return {
    id, userId: null, studentId: null, name, nickname: null, jerseyNo: id,
    position: "OH", heightCm: null, weightKg: null, dominantHand: null,
    birthDate: null, joinedAt: "2024-09-01", grade: null, isActive,
    memberType: MEMBER_TYPE.Player, notes: null, updatedAt: null, updatedByName: null,
  };
}

const EVENT: MatchEventDetail = {
  id: 5, matchDate: "2025-03-01T00:00:00", matchType: "Friendly", academicYear: 113,
  matchName: "校內盃", location: null, ranking: null, rankingB: null, videoUrl: null,
  notes: null, squadCount: 1, createdAt: "2025-03-01T00:00:00Z", updatedAt: null,
  updatedByName: null,
  players: [
    { playerId: 1, name: "現役學妹", jerseyNo: 1, position: "OH", ourSquad: null },
    { playerId: 2, name: "畢業學姊", jerseyNo: 2, position: "OH", ourSquad: null },
    { playerId: 4, name: "離隊隊友", jerseyNo: 4, position: "MB", ourSquad: null },
  ],
  matches: [],
};

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/match-logs/:id" element={<MatchLogEditPage />} />
          <Route path="/match-logs" element={<div>列表頁</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const chipButton = (name: string) => screen.getByText(name).closest("button")!;
const lastUpdatePayload = () => vi.mocked(matchEventsApi.update).mock.calls.at(-1)![1];

beforeEach(() => {
  vi.clearAllMocks();
  const all = [
    makePlayer(1, "現役學妹", PLAYER_STATUS.Active),
    makePlayer(2, "畢業學姊", PLAYER_STATUS.Graduated),
    makePlayer(3, "另一位學姊", PLAYER_STATUS.Graduated),
    makePlayer(4, "離隊隊友", PLAYER_STATUS.Left),
    makePlayer(5, "另一位離隊", PLAYER_STATUS.Left),
  ];
  // 比照後端：activeOnly=true 只回現役
  vi.mocked(playersApi.list).mockImplementation(async (opts = {}) => {
    const activeOnly = typeof opts === "boolean" ? opts : opts.activeOnly;
    return activeOnly ? all.filter((p) => p.isActive === PLAYER_STATUS.Active) : all;
  });
  vi.mocked(matchEventsApi.get).mockResolvedValue(EVENT);
  // 「儲存」鈕需要 matchlogs.edit 權限
  useAuthStore.getState().setAuth("tok", new Date(Date.now() + 60_000).toISOString(), {
    id: 1, userName: "TESTER", email: "t@example.com", roleId: 1, role: "Admin",
    permissions: [PERM.MatchLogsEdit], allowedPages: ["match-logs"],
  });
});

describe("MatchLogEdit 出賽名單：畢業／離隊球員", () => {
  it("編輯含畢業學姊的賽事時，她會出現並標示「畢業」；其他畢業生預設不顯示", async () => {
    renderAt("/match-logs/5");
    expect(await screen.findByText("畢業學姊")).toBeInTheDocument();
    expect(chipButton("畢業學姊")).toHaveTextContent("畢業");
    expect(screen.queryByText("另一位學姊")).not.toBeInTheDocument();
  });

  it("編輯含離隊球員的賽事時，她會出現並標示「離隊」；其他離隊者預設不顯示", async () => {
    renderAt("/match-logs/5");
    expect(await screen.findByText("離隊隊友")).toBeInTheDocument();
    expect(chipButton("離隊隊友")).toHaveTextContent("離隊");
    expect(screen.queryByText("另一位離隊")).not.toBeInTheDocument();
  });

  it("取消勾選畢業學姊後仍留在畫面上，存檔不會帶她", async () => {
    renderAt("/match-logs/5");
    await screen.findByText("畢業學姊");
    fireEvent.click(chipButton("畢業學姊"));
    expect(screen.getByText("畢業學姊")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /儲存/ }));
    await waitFor(() => expect(matchEventsApi.update).toHaveBeenCalled());
    expect(lastUpdatePayload().players.map((p) => p.playerId)).toEqual([1, 4]);
  });

  it("打開「顯示畢業／離隊球員」後可選其他畢業學姊", async () => {
    renderAt("/match-logs/5");
    await screen.findByText("畢業學姊");
    fireEvent.click(screen.getByRole("switch", { name: "顯示畢業／離隊球員" }));
    await screen.findByText("另一位學姊");
    fireEvent.click(chipButton("另一位學姊"));
    fireEvent.click(screen.getByRole("button", { name: /儲存/ }));
    await waitFor(() => expect(matchEventsApi.update).toHaveBeenCalled());
    expect(lastUpdatePayload().players.map((p) => p.playerId).sort()).toEqual([1, 2, 3, 4]);
  });
});
