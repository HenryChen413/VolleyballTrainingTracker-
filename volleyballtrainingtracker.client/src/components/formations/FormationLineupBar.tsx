import MatchEventSelector from "@/components/tactics/MatchEventSelector";
import { SQUAD_KEYS, type useRosterSource } from "@/components/tactics/useRosterSource";

interface Props {
  source: ReturnType<typeof useRosterSource>;
}

/** 站位頁的陣容列：預設「位置代號」，選了賽事（＋隊別）後可在場上點球員改選 */
export default function FormationLineupBar({ source }: Props) {
  return (
    <div className="space-y-1">
      <MatchEventSelector
        allLabel="位置代號"
        mode={source.mode}
        eventId={source.eventId}
        events={source.eventsQuery.data}
        eventsLoading={source.eventsQuery.isLoading}
        onModeChange={source.setMode}
        onEventChange={(id) => {
          source.setEventId(id);
          source.setSquad(SQUAD_KEYS[0]);
        }}
        squads={source.squadOptions}
        squad={source.activeSquad}
        onSquadChange={source.setSquad}
      />
      {source.roster && (
        <p className="text-xs text-muted-foreground">已依主要位置自動帶入球員，點場上球員可改選。</p>
      )}
    </div>
  );
}
