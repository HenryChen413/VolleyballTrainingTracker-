import { useEffect } from "react";

export const UNSAVED_CONFIRM = "站位有未儲存的修改，確定要離開嗎？";

/**
 * 有未儲存修改時保護離開：
 * - 關閉／重新整理分頁：beforeunload（瀏覽器原生提示）。
 * - 站內換頁：專案使用 BrowserRouter（非 data router），無法用 useBlocker；
 *   改在 document capture 階段攔截 <a> 點擊（側欄、底部列皆為連結），同步跳原生確認框，
 *   取消時 preventDefault + stopPropagation，React Router 的 Link 就不會導頁。
 *   瀏覽器「上一頁」不在保護範圍。
 */
export function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank") return;
      if (!window.confirm(UNSAVED_CONFIRM)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
}
