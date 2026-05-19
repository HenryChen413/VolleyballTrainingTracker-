import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Volleyball, Trophy } from "lucide-react";
import { sessionsApi, type SessionListItem } from "@/api/sessions";
import { matchEventsApi, type MatchEventListItem } from "@/api/matchLogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import CalendarEventDialog, { type CalendarEvent } from "@/components/CalendarEventDialog";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// 本機時區的 YYYY-MM-DD（避免 toISOString 的 UTC 位移）
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
}

// 產生整月格線（補滿前後週，週日起算）
function buildGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date, key: ymd(date), inMonth: date.getMonth() === month });
  }
  // 尾端整週若全不在本月則裁掉（最少 5 週、最多 6 週）
  return cells.slice(0, cells.slice(35).some((c) => c.inMonth) ? 42 : 35);
}

type DayEvent =
  | { kind: "session"; id: number; label: string; session: SessionListItem }
  | { kind: "match"; id: number; label: string; match: MatchEventListItem };

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.list(),
  });
  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ["match-events"],
    queryFn: () => matchEventsApi.list(),
  });
  const isLoading = loadingSessions || loadingMatches;

  // 依日期彙整事件
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const push = (key: string, ev: DayEvent) => {
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    };
    for (const s of (sessions ?? []) as SessionListItem[]) {
      push(s.sessionDate.slice(0, 10), {
        kind: "session",
        id: s.id,
        label: s.location || "訓練",
        session: s,
      });
    }
    for (const m of (matches ?? []) as MatchEventListItem[]) {
      push(m.matchDate.slice(0, 10), {
        kind: "match",
        id: m.id,
        label: m.matchName || "比賽",
        match: m,
      });
    }
    return map;
  }, [sessions, matches]);

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor]);
  const todayKey = ymd(today);

  const monthCount = useMemo(() => {
    let s = 0;
    let m = 0;
    for (const c of grid) {
      if (!c.inMonth) continue;
      for (const ev of eventsByDay.get(c.key) ?? []) {
        if (ev.kind === "session") s++;
        else m++;
      }
    }
    return { s, m };
  }, [grid, eventsByDay]);

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const goToday = () =>
    setCursor({ year: today.getFullYear(), month: today.getMonth() });

  const isCurrentMonth =
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  return (
    <div className="space-y-5">
      {/* 頁首 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">行事曆</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            訓練與比賽的月檢視 · 點擊項目可前往該筆紀錄
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="上個月">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[7.5rem] text-center font-numeric text-lg font-semibold tabular-nums">
            {cursor.year} 年 {cursor.month + 1} 月
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="下個月">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant={isCurrentMonth ? "ghost" : "outline"}
            size="sm"
            onClick={goToday}
            disabled={isCurrentMonth}
            className="ml-1"
          >
            本月
          </Button>
        </div>
      </div>

      {/* 圖例 + 當月統計 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          訓練 <span className="font-numeric font-semibold">{monthCount.s}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-navy" />
          比賽 <span className="font-numeric font-semibold">{monthCount.m}</span>
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-[28rem] rounded-lg" />
      ) : (
        <Card className="overflow-hidden">
          {/* 週標題 */}
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={cn(
                  "py-2 text-center text-xs font-medium text-muted-foreground",
                  (i === 0 || i === 6) && "text-primary/70",
                )}
              >
                {w}
              </div>
            ))}
          </div>
          {/* 日期格 */}
          <div className="grid grid-cols-7">
            {grid.map((cell) => {
              const events = eventsByDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              return (
                <div
                  key={cell.key}
                  className={cn(
                    "min-h-[5.5rem] border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                    !cell.inMonth && "bg-muted/30",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-numeric",
                        isToday
                          ? "bg-primary font-bold text-primary-foreground"
                          : cell.inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50",
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {events.map((ev) => (
                      <button
                        key={`${ev.kind}-${ev.id}`}
                        type="button"
                        onClick={() =>
                          setSelected(
                            ev.kind === "session"
                              ? { kind: "session", session: ev.session }
                              : { kind: "match", match: ev.match },
                          )
                        }
                        title={ev.label}
                        className={cn(
                          "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors",
                          ev.kind === "session"
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "bg-navy/10 text-navy hover:bg-navy/20",
                        )}
                      >
                        {ev.kind === "session" ? (
                          <Volleyball className="h-3 w-3 shrink-0" />
                        ) : (
                          <Trophy className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">{ev.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <CalendarEventDialog event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
