import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { MatchEventListItem } from "@/api/matchLogs";

/** 名單來源模式：全部現役球員，或某類型賽事的報名球員 */
export type TacticsMode = "all" | "Friendly" | "Official";

const MODE_OPTIONS: ReadonlyArray<{ value: TacticsMode; label: string }> = [
  { value: "all", label: "全部球員" },
  { value: "Friendly", label: "友誼賽" },
  { value: "Official", label: "正式比賽" },
];

/** 賽事分隊時的一個隊別選項（代碼＋該隊報名人數） */
export interface SquadOption {
  key: string;
  count: number;
}

interface Props {
  mode: TacticsMode;
  eventId: number | null;
  /** 全部賽事（由頁面以 react-query 載入），本元件依 mode 過濾類型 */
  events: MatchEventListItem[] | undefined;
  eventsLoading?: boolean;
  onModeChange: (mode: TacticsMode) => void;
  onEventChange: (eventId: number | null) => void;
  /** 可選的隊別（選中賽事未分隊時為空陣列，整組切換不顯示） */
  squads: ReadonlyArray<SquadOption>;
  /** 目前選中的隊別；null＝未分隊或尚未選賽事 */
  squad: string | null;
  onSquadChange: (squad: string) => void;
}

/**
 * 賽事選擇（二段式）：先選名單來源類型，選了賽事類型後再從下拉選一場，
 * 名單即為該場的報名球員。
 *
 * 若該場賽事分成 A、B 兩隊去打（MatchEvent.squadCount >= 2），再多一段
 * 隊別切換，名單只顯示該隊球員；未分隊的賽事完全不顯示這一段。
 */
export default function MatchEventSelector({
  mode,
  eventId,
  events,
  eventsLoading,
  onModeChange,
  onEventChange,
  squads,
  squad,
  onSquadChange,
}: Props) {
  const filtered = (events ?? []).filter((e) => e.matchType === mode);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        {MODE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={mode === opt.value ? "default" : "ghost"}
            onClick={() => {
              if (mode === opt.value) return;
              onModeChange(opt.value);
              onEventChange(null); // 換類型時重選賽事
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {mode !== "all" && (
        <Select
          className="h-9 w-auto min-w-[220px] max-w-full"
          value={eventId ?? ""}
          onChange={(e) => onEventChange(e.target.value ? Number(e.target.value) : null)}
          disabled={eventsLoading}
          aria-label="選擇賽事"
        >
          <option value="">
            {eventsLoading
              ? "賽事載入中…"
              : filtered.length === 0
                ? "（此類型尚無賽事）"
                : "— 請選擇賽事 —"}
          </option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>
              {e.matchDate.slice(0, 10)} · {e.matchName || e.location || "未命名賽事"}（
              {e.playerCount} 人）
            </option>
          ))}
        </Select>
      )}

      {/* 隊別切換：只有分隊的賽事才出現。沿用上方「名單來源」的分段按鈕樣式，
          兩段操作視覺一致；一次只排一隊，故不需要 A/B 各自配色。 */}
      {squads.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">隊伍</span>
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {squads.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={squad === s.key ? "default" : "ghost"}
                aria-pressed={squad === s.key}
                aria-label={`${s.key}隊，${s.count} 人`}
                onClick={() => onSquadChange(s.key)}
              >
                {s.key}隊
                <span className="ml-1 text-xs tabular-nums opacity-80">{s.count}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
