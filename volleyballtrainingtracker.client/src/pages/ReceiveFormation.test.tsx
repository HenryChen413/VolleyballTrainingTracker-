import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formationsApi, type FormationKey } from "@/api/formations";
import { defaultReceiveLayout } from "@/lib/formations/defaults";
import { useAuthStore } from "@/stores/authStore";
import ReceiveFormationPage from "./ReceiveFormation";

vi.mock("@/api/formations", async () => {
  const actual = await vi.importActual<typeof import("@/api/formations")>("@/api/formations");
  return { ...actual, formationsApi: { get: vi.fn(), save: vi.fn() } };
});
vi.mock("@/api/matchLogs", async () => {
  const actual = await vi.importActual<typeof import("@/api/matchLogs")>("@/api/matchLogs");
  return { ...actual, matchEventsApi: { ...actual.matchEventsApi, list: vi.fn().mockResolvedValue([]) } };
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ReceiveFormationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    accessToken: "t",
    expiresAt: "2099-01-01T00:00:00Z",
    user: { id: 1, userName: "U", email: "u@example.com", roleId: 1, role: "Player", permissions: [], allowedPages: ["receive"] },
  });
  vi.mocked(formationsApi.get).mockReset().mockImplementation(async (key: FormationKey) => ({
    key, layout: null, version: 0, updatedAt: null, updatedByName: null,
  }));
});

describe("接發站位頁", () => {
  it("顯示輪轉標籤，R1 前排有攔中1、沒有攔中2", async () => {
    renderPage();
    expect(await screen.findByText("R1（舉球在3號位）")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "攔中1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "攔中2" })).not.toBeInTheDocument();
  });

  it("切到 R3：攔中1 由自由替換、改顯示攔中2", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "R3" }));
    expect(screen.getByRole("button", { name: "攔中2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "攔中1" })).not.toBeInTheDocument();
  });

  it("接發站位違規時列出說明；進攻位置影格不檢查", async () => {
    const l = defaultReceiveLayout("receive-2oh");
    l.rotations[0].receive.OH1 = { x: 0.9, y: 0.08 };
    vi.mocked(formationsApi.get).mockImplementation(async (key: FormationKey) => ({
      key, layout: key === "receive-2oh" ? l : null, version: key === "receive-2oh" ? 1 : 0, updatedAt: null, updatedByName: null,
    }));
    renderPage();
    expect(await screen.findByText("4號位（主攻1）須在3號位（舉球）左側")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "進攻位置" }));
    expect(screen.queryByText("4號位（主攻1）須在3號位（舉球）左側")).not.toBeInTheDocument();
  });

  it("三個接發體系可切換，預設為主攻1＋自由＋主攻2", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "主攻1＋自由＋主攻2" })).toHaveAttribute("aria-pressed", "true");
    for (const label of ["主攻1＋自由＋副攻", "主攻2＋自由＋副攻"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    }
    expect(screen.getByRole("button", { name: "主攻1＋自由＋主攻2" })).toHaveAttribute("aria-pressed", "false");
  });
});
