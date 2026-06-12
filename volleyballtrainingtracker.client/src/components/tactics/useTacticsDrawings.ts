import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_COLOR,
  DEFAULT_WIDTH,
  arrowSizeFor,
  type Drawing,
} from "@/lib/drawing";

// 戰術線草稿持久化：與球員站位（vbtt-tactics-draft）**刻意分開 key**，
// 兩個 hook 各自整包讀寫，同一 key 會互相覆蓋；分開也對齊 Phase 2 資料庫
// Layout / Drawings 分欄的設計。同樣依名單來源（sourceKey）各自保存。
const STORAGE_KEY = "vbtt-tactics-drawings";

type Boards = Record<string, Drawing[]>;

function loadBoards(): Boards {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { version?: unknown; boards?: unknown };
      if (o.version === 1 && o.boards && typeof o.boards === "object") {
        return o.boards as Boards;
      }
    }
  } catch {
    /* localStorage 不可用或格式損毀，落回空白 */
  }
  return {};
}

function saveBoards(boards: Boards) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, boards }));
  } catch {
    /* 隱私模式等情境可能拒寫，靜默忽略 */
  }
}

export interface DrawingStyle {
  color: string;
  width: number;
}

/**
 * 戰術線狀態的唯一入口：新增 / 更新（移動、端點、樣式）/ 刪除 / 清空 / 選取，
 * 並負責草稿持久化。所有 drawings 變更都收斂到單一 apply()，
 * 之後加 Undo/Redo 只需在 apply 內掛歷史堆疊，元件不用動。
 */
export function useTacticsDrawings(sourceKey: string) {
  const [boards, setBoards] = useState<Boards>(() => loadBoards());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 「下一條線」的樣式；選取狀態下變更會同步套用到選取中的線
  const [style, setStyle] = useState<DrawingStyle>({
    color: DEFAULT_COLOR,
    width: DEFAULT_WIDTH,
  });

  // 任何變更後同步到 localStorage（外部系統，僅寫出、不 setState）
  useEffect(() => {
    saveBoards(boards);
  }, [boards]);

  const drawings = useMemo(() => boards[sourceKey] ?? [], [boards, sourceKey]);

  // 切換名單來源（或線被刪）後選取目標可能已不存在：以派生值歸零，不需 effect
  const effectiveSelectedId = useMemo(
    () => (selectedId && drawings.some((d) => d.id === selectedId) ? selectedId : null),
    [selectedId, drawings],
  );

  /** 所有 drawings 變更的共同入口（Undo/Redo 預留接縫） */
  const apply = useCallback(
    (fn: (cur: Drawing[]) => Drawing[]) => {
      setBoards((prev) => {
        const cur = prev[sourceKey] ?? [];
        const next = fn(cur);
        return next === cur ? prev : { ...prev, [sourceKey]: next };
      });
    },
    [sourceKey],
  );

  const addDrawing = useCallback(
    (d: Drawing) => {
      apply((cur) => [...cur, d]);
    },
    [apply],
  );

  const updateDrawing = useCallback(
    (id: string, patch: Partial<Omit<Drawing, "id">>) => {
      apply((cur) => cur.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    },
    [apply],
  );

  const removeDrawing = useCallback(
    (id: string) => {
      apply((cur) => cur.filter((d) => d.id !== id));
      setSelectedId((sel) => (sel === id ? null : sel));
    },
    [apply],
  );

  const clearDrawings = useCallback(() => {
    apply(() => []);
    setSelectedId(null);
  }, [apply]);

  const selectDrawing = useCallback((id: string | null) => setSelectedId(id), []);

  /** 變更樣式：套用到「下一條線」，若有選取中的線則同步修改它（含箭頭大小連動） */
  const applyStyle = useCallback(
    (patch: Partial<DrawingStyle>) => {
      setStyle((cur) => ({ ...cur, ...patch }));
      const sel = effectiveSelectedId;
      if (sel) {
        apply((cur) =>
          cur.map((d) => {
            if (d.id !== sel) return d;
            const next = { ...d, ...patch };
            if (patch.width != null && d.kind === "arrow") {
              next.arrowSize = arrowSizeFor(patch.width);
            }
            return next;
          }),
        );
      }
    },
    [apply, effectiveSelectedId],
  );

  return {
    drawings,
    selectedId: effectiveSelectedId,
    style,
    addDrawing,
    updateDrawing,
    removeDrawing,
    clearDrawings,
    selectDrawing,
    applyStyle,
  };
}
