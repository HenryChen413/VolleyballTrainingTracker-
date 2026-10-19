import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formationsApi } from "@/api/formations";
import { confirmAction } from "@/lib/swal";
import { PERM, useAuthStore } from "@/stores/authStore";
import DefenseFormationPage from "./DefenseFormation";

vi.mock("@/api/formations", async () => {
  const actual = await vi.importActual<typeof import("@/api/formations")>("@/api/formations");
  return { ...actual, formationsApi: { get: vi.fn(), save: vi.fn() } };
});
vi.mock("@/api/matchLogs", async () => {
  const actual = await vi.importActual<typeof import("@/api/matchLogs")>("@/api/matchLogs");
  return { ...actual, matchEventsApi: { ...actual.matchEventsApi, list: vi.fn().mockResolvedValue([]) } };
});
vi.mock("@/lib/swal", async () => {
  const actual = await vi.importActual<typeof import("@/lib/swal")>("@/lib/swal");
  return { ...actual, confirmAction: vi.fn() };
});

function loginAs(permissions: string[]) {
  useAuthStore.setState({
    accessToken: "t",
    expiresAt: "2099-01-01T00:00:00Z",
    user: {
      id: 1, userName: "U", email: "u@example.com", roleId: 1, role: "Coach",
      permissions, allowedPages: ["defense", "receive"],
    },
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DefenseFormationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(formationsApi.get).mockReset().mockResolvedValue({
    key: "defense", layout: null, version: 0, updatedAt: null, updatedByName: null,
  });
  vi.mocked(formationsApi.save).mockReset();
  vi.mocked(confirmAction).mockReset().mockResolvedValue({ isConfirmed: true } as never);
});

describe("防守站位頁", () => {
  it("無編輯權限：看得到預設情況、沒有編輯鈕、不顯示格式異常", async () => {
    loginAs([]);
    renderPage();
    expect(await screen.findByRole("button", { name: "對方打4號位" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "編輯" })).not.toBeInTheDocument();
    expect(screen.queryByText(/站位資料格式異常/)).not.toBeInTheDocument();
  });

  it("有權限才看得到編輯鈕", async () => {
    loginAs([PERM.FormationsEdit]);
    renderPage();
    expect(await screen.findByRole("button", { name: "編輯" })).toBeInTheDocument();
  });

  it("切換情況時球員移到新位置", async () => {
    loginAs([]);
    renderPage();
    const token = await screen.findByRole("button", { name: "主攻(前)" });
    const before = token.style.left;
    fireEvent.click(screen.getByRole("button", { name: "對方打4號位" }));
    expect(screen.getByRole("button", { name: "主攻(前)" }).style.left).not.toBe(before);
  });

  it("儲存遇到 409：顯示誰更新了，並保留編輯狀態", async () => {
    loginAs([PERM.FormationsEdit]);
    vi.mocked(formationsApi.save).mockRejectedValue({
      response: { status: 409, data: { message: "x", version: 2, updatedAt: "2026-10-19T00:00:00Z", updatedByName: "教練乙" } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "編輯" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("教練乙");
    expect(screen.getByRole("button", { name: "儲存" })).toBeInTheDocument();
  });

  it("套用到另一組：確認後切到目標組，舉球與副攻都留在原本的位置", async () => {
    loginAs([PERM.FormationsEdit]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "編輯" }));
    fireEvent.click(screen.getByRole("button", { name: "對方打4號位" }));
    const setter = screen.getByRole("button", { name: "舉球" }).style;
    const opp = screen.getByRole("button", { name: "副攻" }).style;
    const before = { s: [setter.left, setter.top], o: [opp.left, opp.top] };
    fireEvent.click(screen.getByRole("button", { name: "套用到舉球員後排" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "舉球員後排" })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(confirmAction).toHaveBeenCalledOnce();
    const s2 = screen.getByRole("button", { name: "舉球" }).style;
    const o2 = screen.getByRole("button", { name: "副攻" }).style;
    expect([s2.left, s2.top]).toEqual(before.s);
    expect([o2.left, o2.top]).toEqual(before.o);
    expect(screen.getByRole("button", { name: "套用到舉球員前排" })).toBeInTheDocument();
  });

  it("檢視模式沒有套用按鈕；取消確認則不變", async () => {
    loginAs([PERM.FormationsEdit]);
    vi.mocked(confirmAction).mockResolvedValue({ isConfirmed: false } as never);
    renderPage();
    await screen.findByRole("button", { name: "編輯" });
    expect(screen.queryByRole("button", { name: "套用到舉球員後排" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "編輯" }));
    fireEvent.click(screen.getByRole("button", { name: "套用到舉球員後排" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "舉球員前排" })).toHaveAttribute("aria-pressed", "true");
  });

  it("刪除正在檢視的情況後回到基本站位", async () => {
    loginAs([PERM.FormationsEdit]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "編輯" }));
    fireEvent.click(screen.getByRole("button", { name: "對方吊球" }));
    fireEvent.click(screen.getByRole("button", { name: "刪除情況" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "對方吊球" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "基本站位" })).toHaveAttribute("aria-pressed", "true");
  });
});
