import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MEMBER_TYPE, playersApi } from "@/api/players";
import { matchEventsApi } from "@/api/matchLogs";
import type { RosterPlayer } from "@/lib/court";
import type { SquadOption, TacticsMode } from "./MatchEventSelector";

/** 賽事分隊時的隊別代碼，對應 MatchEventPlayer.ourSquad（見 MatchLogEdit 的分隊設定） */
export const SQUAD_KEYS = ["A", "B"] as const;

/**
 * 名單來源（戰術板、防守／接發站位共用）：全部現役球員，或某場賽事（＋隊別）的報名球員。
 * loadAllPlayers=false 時「all」模式不載入球員、roster 為 undefined
 * （站位頁的「位置代號」模式只顯示代號）。
 */
export function useRosterSource({ loadAllPlayers }: { loadAllPlayers: boolean }) {
  const [mode, setMode] = useState<TacticsMode>("all");
  const [eventId, setEventId] = useState<number | null>(null);
  // 賽事分成 A、B 兩隊時要排哪一隊；未分隊的賽事此值不生效（見 activeSquad）
  const [squad, setSquad] = useState<string>(SQUAD_KEYS[0]);

  const playersQuery = useQuery({
    queryKey: ["players", { activeOnly: true, memberType: MEMBER_TYPE.Player }],
    queryFn: () => playersApi.list({ activeOnly: true, memberType: MEMBER_TYPE.Player }),
    enabled: loadAllPlayers && mode === "all",
  });
  const eventsQuery = useQuery({
    queryKey: ["matchEvents"],
    queryFn: () => matchEventsApi.list(),
    enabled: mode !== "all",
  });

  const selectedEvent = useMemo(
    () => (eventId != null ? eventsQuery.data?.find((e) => e.id === eventId) : undefined),
    [eventsQuery.data, eventId],
  );

  const activeSquad = (selectedEvent?.squadCount ?? 1) >= 2 ? squad : null;

  const squadOptions = useMemo<SquadOption[]>(() => {
    if (activeSquad == null || !selectedEvent) return [];
    return SQUAD_KEYS.map((key) => ({
      key,
      count: selectedEvent.players.filter((p) => p.ourSquad === key).length,
    }));
  }, [activeSquad, selectedEvent]);

  // undefined = 載入中／尚未選賽事／站位頁的位置代號模式
  const roster = useMemo<RosterPlayer[] | undefined>(() => {
    if (mode === "all") {
      if (!loadAllPlayers) return undefined;
      return playersQuery.data?.map((p) => ({
        playerId: p.id,
        jerseyNo: p.jerseyNo,
        name: p.name,
        position: p.position,
      }));
    }
    return selectedEvent?.players
      // 分隊賽事只取該隊球員；報名了但未指定隊別者不屬於任何一隊
      .filter((p) => activeSquad == null || p.ourSquad === activeSquad)
      .map((p) => ({
        playerId: p.playerId,
        jerseyNo: p.jerseyNo,
        name: p.name,
        position: p.position,
      }));
  }, [mode, loadAllPlayers, playersQuery.data, selectedEvent, activeSquad]);

  const sourceKey =
    mode === "all"
      ? "all"
      : eventId == null
        ? "event:none"
        : activeSquad
          ? `event:${eventId}:${activeSquad}`
          : `event:${eventId}`;

  return {
    mode, setMode, eventId, setEventId, squad, setSquad,
    playersQuery, eventsQuery, selectedEvent, activeSquad, squadOptions, roster, sourceKey,
  };
}
