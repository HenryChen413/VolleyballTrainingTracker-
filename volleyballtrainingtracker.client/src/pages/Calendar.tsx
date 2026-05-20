import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Volleyball, Trophy, Handshake } from "lucide-react";
import { sessionsApi, type SessionListItem } from "@/api/sessions";
import { matchEventsApi, type MatchEventListItem, type MatchLogItem } from "@/api/matchLogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import CalendarEventDialog, { type CalendarEvent } from "@/components/CalendarEventDialog";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// 行事曆事件的圓點配色（手機版簡化呈現用）
function eventDotClass(ev: DayEvent): string {
  if (ev.kind === "session") return "bg-primary";
  return ev.matchType === "Friendly" ? "bg-warning" : "bg-navy";
}

// 議程列日期格式：M/D（週X）
function formatAgendaDate(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}（週${WEEKDAYS[d.getDay()]}）`;
}

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
  | {
      kind: "match";
      id: string;
      label: string;
      matchType: string | null;
      date: string;
      match: MatchEventListItem;
      dayMatches: MatchLogItem[];
    };

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  // 手機版議程焦點日：預設今天；切換月份時自動跳到該月 1 號或今天
  const [selectedDay, setSelectedDay] = useState<string>(() => ymd(today));

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
    // 比賽：依「子層 MatchLog.matchDate」分桶；未填則 fallback 至父層起始日。
    // 一場跨日賽事會在每一天各自落點，當日對戰也只顯示該日的對手清單。
    for (const ev of (matches ?? []) as MatchEventListItem[]) {
      const start = ev.matchDate.slice(0, 10);
      const buckets = new Map<string, MatchLogItem[]>();
      for (const m of ev.matches) {
        const d = m.matchDate ? m.matchDate.slice(0, 10) : start;
        const arr = buckets.get(d) ?? [];
        arr.push(m);
        buckets.set(d, arr);
      }
      // 完全沒有對戰時，仍在起始日掛一筆，避免事件「消失」
      if (buckets.size === 0) buckets.set(start, []);
      for (const [day, dayMatches] of buckets) {
        const opponents = dayMatches
          .map((m) => m.opponent)
          .filter((s): s is string => Boolean(s));
        const name = ev.matchName ?? "";
        // 友誼賽：只顯示賽事名稱；比賽：賽事名稱 + 對手清單
        let label: string;
        if (ev.matchType === "Friendly") {
          label = name || "友誼賽";
        } else if (name && opponents.length > 0) {
          label = `${name}・${opponents.join("、")}`;
        } else if (name) {
          label = name;
        } else if (opponents.length > 0) {
          label = opponents.join("、");
        } else {
          label = "比賽";
        }
        push(day, {
          kind: "match",
          id: `${ev.id}-${day}`,
          label,
          matchType: ev.matchType,
          date: day,
          match: ev,
          dayMatches,
        });
      }
    }
    return map;
  }, [sessions, matches]);

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor]);
  const todayKey = ymd(today);

  const monthCount = useMemo(() => {
    let s = 0;
    let mO = 0;
    let mF = 0;
    for (const c of grid) {
      if (!c.inMonth) continue;
      for (const ev of eventsByDay.get(c.key) ?? []) {
        if (ev.kind === "session") s++;
        else if (ev.matchType === "Friendly") mF++;
        else mO++;
      }
    }
    return { s, mO, mF };
  }, [grid, eventsByDay]);

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      const isThisMonth =
        d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      setSelectedDay(isThisMonth ? ymd(today) : ymd(d));
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDay(ymd(today));
  };

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

      {/* 圖例 + 當月統計（區分比賽 / 友誼賽） */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          訓練 <span className="font-numeric font-semibold">{monthCount.s}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-navy" />
          比賽 <span className="font-numeric font-semibold">{monthCount.mO}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-warning" />
          友誼賽 <span className="font-numeric font-semibold">{monthCount.mF}</span>
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
              const isSelected = cell.key === selectedDay;
              const dotMax = 3;
              const dotItems = events.slice(0, dotMax);
              const dotMore = events.length - dotItems.length;
              return (
                <div
                  key={cell.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDay(cell.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDay(cell.key);
                    }
                  }}
                  className={cn(
                    "min-h-[3.25rem] border-b border-r p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0 cursor-pointer transition-colors",
                    "sm:min-h-[5.5rem] sm:p-1.5",
                    !cell.inMonth && "bg-muted/30",
                    // 手機版：選中日加底色強調；桌面版維持靜態（標籤點擊另開 dialog）
                    isSelected && "bg-primary/5 sm:bg-transparent",
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

                  {/* 手機版：只用圓點呈現（資訊密度高，避免文字截斷） */}
                  <div className="flex items-center gap-0.5 sm:hidden">
                    {dotItems.map((ev) => (
                      <span
                        key={`dot-${ev.kind}-${ev.id}`}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          eventDotClass(ev),
                        )}
                        aria-hidden
                      />
                    ))}
                    {dotMore > 0 && (
                      <span className="text-[9px] leading-none text-muted-foreground font-numeric ml-0.5">
                        +{dotMore}
                      </span>
                    )}
                  </div>

                  {/* 桌面版：完整 label 標籤 */}
                  <div className="hidden sm:block space-y-1">
                    {events.map((ev) => {
                      const isFriendly = ev.kind === "match" && ev.matchType === "Friendly";
                      return (
                        <button
                          key={`${ev.kind}-${ev.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(
                              ev.kind === "session"
                                ? { kind: "session", session: ev.session }
                                : {
                                    kind: "match",
                                    match: ev.match,
                                    dayMatches: ev.dayMatches,
                                    date: ev.date,
                                  },
                            );
                          }}
                          title={ev.label}
                          className={cn(
                            "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors",
                            ev.kind === "session"
                              ? "bg-primary/10 text-primary hover:bg-primary/20"
                              : isFriendly
                                ? "bg-warning/10 text-warning hover:bg-warning/20"
                                : "bg-navy/10 text-navy hover:bg-navy/20",
                          )}
                        >
                          {ev.kind === "session" ? (
                            <Volleyball className="h-3 w-3 shrink-0" />
                          ) : isFriendly ? (
                            <Handshake className="h-3 w-3 shrink-0" />
                          ) : (
                            <Trophy className="h-3 w-3 shrink-0" />
                          )}
                          <span className="truncate">{ev.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 手機版：當日 Agenda — 顯示完整文字、不截斷；點擊可開啟 dialog */}
      {!isLoading && (
        <Card className="p-3 sm:hidden">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              {formatAgendaDate(selectedDay)} 的事件
            </h2>
            <span className="text-[11px] text-muted-foreground font-numeric">
              共 {(eventsByDay.get(selectedDay) ?? []).length} 筆
            </span>
          </div>
          {(eventsByDay.get(selectedDay) ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">當日尚無訓練或比賽紀錄</p>
          ) : (
            <ul className="space-y-1.5">
              {(eventsByDay.get(selectedDay) ?? []).map((ev) => {
                const isFriendly = ev.kind === "match" && ev.matchType === "Friendly";
                return (
                  <li key={`agenda-${ev.kind}-${ev.id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected(
                          ev.kind === "session"
                            ? { kind: "session", session: ev.session }
                            : {
                                kind: "match",
                                match: ev.match,
                                dayMatches: ev.dayMatches,
                                date: ev.date,
                              },
                        )
                      }
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                        ev.kind === "session"
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : isFriendly
                            ? "bg-warning/10 text-warning hover:bg-warning/20"
                            : "bg-navy/10 text-navy hover:bg-navy/20",
                      )}
                    >
                      {ev.kind === "session" ? (
                        <Volleyball className="h-4 w-4 mt-0.5 shrink-0" />
                      ) : isFriendly ? (
                        <Handshake className="h-4 w-4 mt-0.5 shrink-0" />
                      ) : (
                        <Trophy className="h-4 w-4 mt-0.5 shrink-0" />
                      )}
                      <span className="text-sm leading-snug break-all">{ev.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <CalendarEventDialog event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
