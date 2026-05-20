import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Clock, MapPin, Video, Trophy, Users, StickyNote, CalendarDays } from "lucide-react";
import { sessionsApi, type SessionListItem, type SessionDrill } from "@/api/sessions";
import { type MatchEventListItem, type MatchLogItem } from "@/api/matchLogs";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";

// 行事曆點選後要顯示的事件（唯讀）
// 比賽帶入「該日對戰」的子清單與當日日期 — 跨日賽事在不同格各自顯示其對戰
export type CalendarEvent =
  | { kind: "session"; session: SessionListItem }
  | {
      kind: "match";
      match: MatchEventListItem;
      dayMatches: MatchLogItem[];
      date: string;
    };

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const CATEGORY_LABELS: Record<string, string> = {
  Basic: "基礎", Serve: "發球", Pass: "接發球", Set: "舉球",
  Attack: "攻擊", Block: "攔網", Dig: "防守", Fitness: "體能",
};
const CATEGORY_ORDER = ["Basic", "Serve", "Pass", "Set", "Attack", "Block", "Dig", "Fitness"];

const MATCH_TYPE_LABEL: Record<string, string> = { Official: "比賽", Friendly: "友誼賽" };
const RESULT_LABEL: Record<string, string> = { W: "勝", L: "敗", D: "平" };
const RESULT_TONE: Record<string, "success" | "destructive" | "neutral"> = {
  W: "success", L: "destructive", D: "neutral",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEKDAYS[d.getDay()]}`;
}

// 一列「圖示 + 文字」資訊
function InfoRow({ icon: Icon, children }: {
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export default function CalendarEventDialog({ event, onClose }: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const sessionId = event?.kind === "session" ? event.session.id : undefined;
  const { data: sessionDetail, isLoading: loadingSession } = useQuery({
    queryKey: ["sessions", String(sessionId)],
    queryFn: () => sessionsApi.get(sessionId!),
    enabled: sessionId !== undefined,
  });

  const drillGroups = useMemo(() => {
    const drills: SessionDrill[] = sessionDetail?.drills ?? [];
    const map = new Map<string, SessionDrill[]>();
    for (const d of drills) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [sessionDetail]);

  const isSession = event?.kind === "session";
  const title = isSession ? "訓練詳情" : "比賽詳情";

  return (
    <Dialog
      open={event !== null}
      onClose={onClose}
      size="lg"
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>關閉</Button>
          <Button
            onClick={() => {
              navigate(isSession ? "/sessions" : "/match-logs");
              onClose();
            }}
          >
            {isSession ? "前往訓練紀錄" : "前往比賽紀錄"}
          </Button>
        </>
      }
    >
      {event?.kind === "session" && (
        <div className="space-y-4">
          <p className="text-base font-semibold">{formatDate(event.session.sessionDate)}</p>
          <div className="space-y-2">
            {event.session.startTime && (
              <InfoRow icon={Clock}>
                <span className="font-numeric">{event.session.startTime}</span>
              </InfoRow>
            )}
            <InfoRow icon={MapPin}>
              {event.session.location || <span className="text-muted-foreground">未指定地點</span>}
            </InfoRow>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">訓練項目</h3>
            {loadingSession ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ) : drillGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未選取訓練項目</p>
            ) : (
              <div className="space-y-3">
                {drillGroups.map(([cat, items]) => (
                  <div key={cat}>
                    <div className="mb-1 flex items-center gap-2">
                      <Chip tone="neutral" size="sm">{CATEGORY_LABELS[cat] ?? cat}</Chip>
                      <span className="text-xs text-muted-foreground font-numeric">
                        {items.length}
                      </span>
                    </div>
                    <ul className="ml-1 space-y-0.5 text-sm">
                      {items.map((d) => (
                        <li key={d.drillId}>{d.drillName}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {event.session.notes && (
            <div className="flex gap-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              <StickyNote className="h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap">{event.session.notes}</span>
            </div>
          )}
        </div>
      )}

      {event?.kind === "match" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{event.match.matchName || "（未命名賽事）"}</p>
            {event.match.matchType && (
              <Chip tone={event.match.matchType === "Official" ? "info" : "warning"} size="sm">
                {MATCH_TYPE_LABEL[event.match.matchType] ?? event.match.matchType}
              </Chip>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(event.date)}</p>

          <div className="space-y-2">
            {/* 多日賽事提示：當日 ≠ 起始日時，補顯示起始日做為脈絡 */}
            {event.date !== event.match.matchDate.slice(0, 10) && (
              <InfoRow icon={CalendarDays}>
                <span className="text-muted-foreground">起始日 {formatDate(event.match.matchDate)}</span>
              </InfoRow>
            )}
            {event.match.location && <InfoRow icon={MapPin}>{event.match.location}</InfoRow>}
            {event.match.ranking && (
              <InfoRow icon={Trophy}>
                {event.match.rankingB
                  ? `A：${event.match.ranking}    B：${event.match.rankingB}`
                  : event.match.ranking}
              </InfoRow>
            )}
            {event.match.playerCount > 0 && (
              <InfoRow icon={Users}>
                <span className="font-numeric">{event.match.playerCount}</span> 人出賽
              </InfoRow>
            )}
            {event.match.videoUrl && (
              <InfoRow icon={Video}>
                <a
                  href={event.match.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  比賽影片
                </a>
              </InfoRow>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">當日對戰</h3>
            {event.dayMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">當日尚未填寫對戰</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {event.dayMatches.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {m.ourSquad && <Chip tone="outline" size="sm">{m.ourSquad}</Chip>}
                      <span className="truncate text-sm">{m.opponent || "—"}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-numeric font-semibold tabular-nums">
                        {m.ourScore ?? "-"} : {m.opponentScore ?? "-"}
                      </span>
                      {m.result && (
                        <Chip tone={RESULT_TONE[m.result] ?? "neutral"} size="sm">
                          {RESULT_LABEL[m.result] ?? m.result}
                        </Chip>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {event.match.notes && (
            <div className="flex gap-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              <StickyNote className="h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap">{event.match.notes}</span>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
