import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clampToCourt,
  firstFreeAnchor,
  type CourtPlayer,
  type RosterPlayer,
} from "@/lib/court";
import { primaryPosition } from "@/lib/positions";

// 草稿持久化於 localStorage：依名單來源（全部球員 / 某場賽事）各自保存一塊白板，
// 切換來源不會互相覆蓋；Phase 2 落地 DB 儲存後，此草稿仍作為「未儲存的工作區」。
const STORAGE_KEY = "vbtt-tactics-draft";

type Boards = Record<string, CourtPlayer[]>;

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

/**
 * 戰術板狀態的唯一入口：場上球員的放置 / 移動 / 交換 / 移除 / 清空，
 * 並負責草稿的載入與持久化。
 *
 * 狀態以「所有來源的白板」整包保存，切換來源只是換一個 key 讀取，
 * 不需要在 effect 內重設 state；名單載入後的校正（已不在名單的球員）
 * 也以派生值過濾呈現，不寫回 state。
 */
export function useTacticsBoard(sourceKey: string, roster: RosterPlayer[] | undefined) {
  const [boards, setBoards] = useState<Boards>(() => loadBoards());

  // 任何狀態變更後同步到 localStorage（外部系統，僅寫出、不 setState）
  useEffect(() => {
    saveBoards(boards);
  }, [boards]);

  const rosterIds = useMemo(
    () => (roster ? new Set(roster.map((r) => r.playerId)) : null),
    [roster],
  );

  // 目前來源的場上球員；名單已載入時過濾掉不在名單中的球員（離隊、賽事名單異動）
  const courtPlayers = useMemo(() => {
    const raw = boards[sourceKey] ?? [];
    return rosterIds ? raw.filter((p) => rosterIds.has(p.playerId)) : raw;
  }, [boards, sourceKey, rosterIds]);

  /** 所有變更的共同入口：以目前顯示中的場上球員為基礎計算下一個白板 */
  const update = useCallback(
    (fn: (cur: CourtPlayer[]) => CourtPlayer[]) => {
      setBoards((prev) => {
        const raw = prev[sourceKey] ?? [];
        const cur = rosterIds ? raw.filter((p) => rosterIds.has(p.playerId)) : raw;
        const next = fn(cur);
        return next === cur ? prev : { ...prev, [sourceKey]: next };
      });
    },
    [sourceKey, rosterIds],
  );

  /** 把名單球員放到場上指定位置（已在場上則忽略） */
  const placePlayer = useCallback(
    (player: RosterPlayer, x: number, y: number) => {
      update((cur) => {
        if (cur.some((p) => p.playerId === player.playerId)) return cur;
        const pos = clampToCourt(x, y);
        return [
          ...cur,
          {
            playerId: player.playerId,
            jerseyNo: player.jerseyNo,
            name: player.name,
            role: primaryPosition(player.position),
            ...pos,
          },
        ];
      });
    },
    [update],
  );

  /** 點選名單球員：自動補到第一個空的輪轉位置（1→6） */
  const quickAddPlayer = useCallback(
    (player: RosterPlayer, rect: DOMRect | null) => {
      update((cur) => {
        if (cur.some((p) => p.playerId === player.playerId)) return cur;
        // 六個輪轉位都滿了就放在我方場區中央，由使用者再拖
        const anchor = firstFreeAnchor(cur, rect) ?? { x: 0.5, y: 0.62 };
        return [
          ...cur,
          {
            playerId: player.playerId,
            jerseyNo: player.jerseyNo,
            name: player.name,
            role: primaryPosition(player.position),
            ...anchor,
          },
        ];
      });
    },
    [update],
  );

  /** 拖曳中即時更新場上球員座標 */
  const movePlayer = useCallback(
    (playerId: number, x: number, y: number) => {
      update((cur) =>
        cur.map((p) => (p.playerId === playerId ? { ...p, ...clampToCourt(x, y) } : p)),
      );
    },
    [update],
  );

  /** 交換兩名球員的站位：被拖者落在目標位置，目標退回被拖者的起拖位置 */
  const swapPlayers = useCallback(
    (draggedId: number, targetId: number, draggedStart: { x: number; y: number }) => {
      update((cur) => {
        const target = cur.find((p) => p.playerId === targetId);
        if (!target) return cur;
        return cur.map((p) => {
          if (p.playerId === draggedId) return { ...p, x: target.x, y: target.y };
          if (p.playerId === targetId) return { ...p, x: draggedStart.x, y: draggedStart.y };
          return p;
        });
      });
    },
    [update],
  );

  /** 把球員移出場地（回到名單區） */
  const removePlayer = useCallback(
    (playerId: number) => {
      update((cur) => cur.filter((p) => p.playerId !== playerId));
    },
    [update],
  );

  /** 清空整個場地 */
  const clearCourt = useCallback(() => update(() => []), [update]);

  return {
    courtPlayers,
    placePlayer,
    quickAddPlayer,
    movePlayer,
    swapPlayers,
    removePlayer,
    clearCourt,
  };
}
