import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnsavedGuard } from "./useUnsavedGuard";

function clickLink() {
  const a = document.createElement("a");
  a.href = "/players";
  document.body.appendChild(a);
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  a.dispatchEvent(ev);
  a.remove();
  return ev;
}

afterEach(() => vi.restoreAllMocks());

describe("useUnsavedGuard", () => {
  it("有未儲存修改時，點站內連結先確認；取消則攔下", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHook(() => useUnsavedGuard(true));
    expect(clickLink().defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("確認離開則放行", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHook(() => useUnsavedGuard(true));
    expect(clickLink().defaultPrevented).toBe(false);
  });

  it("沒有未儲存修改時不打擾", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderHook(() => useUnsavedGuard(false));
    expect(clickLink().defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("卸載後移除監聽", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { unmount } = renderHook(() => useUnsavedGuard(true));
    unmount();
    expect(clickLink().defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });
});
