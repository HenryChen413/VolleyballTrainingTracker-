import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { formationsApi } from "@/api/formations";
import { defaultDefenseLayout } from "@/lib/formations/defaults";
import { parseDefenseLayout } from "@/lib/formations/layout";
import { useFormation } from "./useFormation";

vi.mock("@/api/formations", async () => {
  const actual = await vi.importActual<typeof import("@/api/formations")>("@/api/formations");
  return { ...actual, formationsApi: { get: vi.fn(), save: vi.fn() } };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const empty = { key: "defense" as const, layout: null, version: 0, updatedAt: null, updatedByName: null };

beforeEach(() => {
  vi.mocked(formationsApi.get).mockReset().mockResolvedValue(empty);
  vi.mocked(formationsApi.save).mockReset();
});

describe("useFormation", () => {
  it("尚未儲存過：顯示預設且不標記格式異常", async () => {
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.layout).not.toBeNull());
    expect(result.current.layout).toEqual(defaultDefenseLayout());
    expect(result.current.recovered).toBe(false);
  });

  it("DB 資料損毀：標記格式異常", async () => {
    vi.mocked(formationsApi.get).mockResolvedValue({ ...empty, layout: { version: 9 }, version: 3 });
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.recovered).toBe(true));
  });

  it("編輯→修改→儲存：帶 expectedVersion，成功後離開編輯", async () => {
    vi.mocked(formationsApi.save).mockImplementation(async (_k, body) => ({
      ...empty, layout: body.layout, version: 1,
    }));
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.layout).not.toBeNull());
    act(() => result.current.startEdit());
    act(() => result.current.update((l) => ({ ...l, situations: [] })));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.save());
    await waitFor(() => expect(result.current.editing).toBe(false));
    expect(vi.mocked(formationsApi.save).mock.calls[0][1].expectedVersion).toBe(0);
    expect(result.current.layout?.situations).toEqual([]);
  });

  it("409：保留草稿並提供衝突資訊", async () => {
    vi.mocked(formationsApi.save).mockRejectedValue({
      response: { status: 409, data: { message: "x", version: 2, updatedAt: "2026-10-19T00:00:00Z", updatedByName: "教練乙" } },
    });
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.layout).not.toBeNull());
    act(() => result.current.startEdit());
    act(() => result.current.update((l) => ({ ...l, situations: [] })));
    act(() => result.current.save());
    await waitFor(() => expect(result.current.conflict?.updatedByName).toBe("教練乙"));
    expect(result.current.editing).toBe(true);
    expect(result.current.layout?.situations).toEqual([]);
  });
});
