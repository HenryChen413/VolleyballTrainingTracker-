import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Expand, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MEMBER_TYPE, playersApi } from "@/api/players";
import { matchEventsApi } from "@/api/matchLogs";
import type { RosterPlayer } from "@/lib/court";
import type { DrawingTool } from "@/lib/drawing";
import { toast } from "@/lib/toast";
import { useFullscreen } from "@/lib/useFullscreen";
import DrawingToolbar from "@/components/tactics/DrawingToolbar";
import MatchEventSelector, { type TacticsMode } from "@/components/tactics/MatchEventSelector";
import PlayerRoster from "@/components/tactics/PlayerRoster";
import TacticsFocusMode from "@/components/tactics/TacticsFocusMode";
import TacticsToolbar from "@/components/tactics/TacticsToolbar";
import VolleyballCourt from "@/components/tactics/VolleyballCourt";
import { useTacticsBoard } from "@/components/tactics/useTacticsBoard";
import { useTacticsDrawings } from "@/components/tactics/useTacticsDrawings";

/**
 * 排球戰術板：
 * 名單來源二段式（全部現役球員／某場賽事的報名球員）＋ SVG 場地拖曳排陣
 * ＋ 戰術畫線（拖曳畫直線／箭頭、選取編輯、橡皮擦）。
 * 站位與戰術線以草稿形式存在本機（localStorage），Phase 2 再加入後端儲存戰術。
 */
export default function TacticsBoardPage() {
  const [mode, setMode] = useState<TacticsMode>("all");
  const [eventId, setEventId] = useState<number | null>(null);
  const [tool, setTool] = useState<DrawingTool>("select");
  const [arrowEnabled, setArrowEnabled] = useState(true);
  const {
    ref: focusRef,
    isFullscreen: focusIsFullscreen,
    cssFullscreen: focusCssFullscreen,
    toggle: toggleFocusMode,
    exit: exitFocusMode,
  } = useFullscreen<HTMLDivElement>();

  // 場地與名單區容器 ref：跨元件做拖曳落點判定（名單拖入場地／token 拖回名單）
  const courtRef = useRef<HTMLDivElement | null>(null);
  const rosterRef = useRef<HTMLDivElement | null>(null);

  const playersQuery = useQuery({
    queryKey: ["players", { activeOnly: true, memberType: MEMBER_TYPE.Player }],
    queryFn: () => playersApi.list({ activeOnly: true, memberType: MEMBER_TYPE.Player }),
    enabled: mode === "all",
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

  // 目前名單（undefined = 載入中或尚未選賽事，不觸發場上球員校正）
  const roster = useMemo<RosterPlayer[] | undefined>(() => {
    if (mode === "all") {
      return playersQuery.data?.map((p) => ({
        playerId: p.id,
        jerseyNo: p.jerseyNo,
        name: p.name,
        position: p.position,
      }));
    }
    return selectedEvent?.players.map((p) => ({
      playerId: p.playerId,
      jerseyNo: p.jerseyNo,
      name: p.name,
      position: p.position,
    }));
  }, [mode, playersQuery.data, selectedEvent]);

  // 草稿依名單來源各自保存，切換不互相覆蓋
  const sourceKey = mode === "all" ? "all" : eventId != null ? `event:${eventId}` : "event:none";

  const board = useTacticsBoard(sourceKey, roster);
  const { courtPlayers } = board;

  // 戰術線（與站位分開的草稿，同樣依來源各自保存）
  const drawingsBoard = useTacticsDrawings(sourceKey);
  const { selectedId, removeDrawing } = drawingsBoard;

  const handleToolChange = (next: DrawingTool) => {
    setTool(next);
    if (next !== "select") drawingsBoard.selectDrawing(null);
  };

  // 專注模式的清除不跳確認框 —— 場邊一次說明要清很多次，
  // 改成先清、再給 3 秒的復原機會，保護力反而優於確認框。
  const handleClearDrawingsWithUndo = () => {
    const snapshot = drawingsBoard.drawings;
    if (snapshot.length === 0) return;
    drawingsBoard.clearDrawings();
    toast.undoable(`已清除 ${snapshot.length} 條戰術線`, "復原", () => {
      snapshot.forEach((d) => drawingsBoard.addDrawing(d));
    });
  };

  // Delete / Backspace 刪除選取中的戰術線（輸入框內不攔截）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (selectedId) {
        e.preventDefault();
        removeDrawing(selectedId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, removeDrawing]);

  // 名單區只顯示「未上場」球員
  const onCourtIds = useMemo(
    () => new Set(courtPlayers.map((p) => p.playerId)),
    [courtPlayers],
  );
  const benchPlayers = useMemo(
    () => (roster ?? []).filter((p) => !onCourtIds.has(p.playerId)),
    [roster, onCourtIds],
  );

  const rosterLoading = mode === "all" ? playersQuery.isLoading : eventsQuery.isLoading;
  const emptyHint =
    mode !== "all" && eventId == null
      ? "請先在上方選擇一場賽事。"
      : (roster?.length ?? 0) > 0
        ? "全部球員都已上場，可把場上球員拖回這裡。"
        : mode === "all"
          ? "目前沒有現役球員。"
          : "這場賽事沒有報名球員。";

  if (focusIsFullscreen) {
    return (
      <div ref={focusRef} className="relative">
        <TacticsFocusMode
          onExit={exitFocusMode}
          cssFullscreen={focusCssFullscreen}
          courtPlayers={courtPlayers}
          courtRef={courtRef}
          rosterRef={rosterRef}
          onMovePlayer={board.movePlayer}
          onSwapPlayers={board.swapPlayers}
          onRemovePlayer={board.removePlayer}
          tool={tool}
          onToolChange={handleToolChange}
          drawings={drawingsBoard.drawings}
          drawStyle={drawingsBoard.style}
          onStyleChange={drawingsBoard.applyStyle}
          arrowEnabled={arrowEnabled}
          onArrowEnabledChange={setArrowEnabled}
          selectedDrawingId={selectedId}
          onAddDrawing={drawingsBoard.addDrawing}
          onUpdateDrawing={drawingsBoard.updateDrawing}
          onRemoveDrawing={removeDrawing}
          onSelectDrawing={drawingsBoard.selectDrawing}
          onClearAll={handleClearDrawingsWithUndo}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ClipboardList className="h-6 w-6 text-primary" />
          戰術板
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          點選或拖曳名單球員到場地排陣；場上球員可拖曳移動、拖到另一人身上交換、拖回名單區（或雙擊）移出。
          場地上方工具列選「畫」即可拖曳畫出戰術路線，切回「選取」可點選線條移動、改色或刪除。
          草稿自動保存在這台裝置。
        </p>
      </div>

      {/* 名單來源（全部球員 / 友誼賽 / 正式比賽 → 選一場賽事） */}
      <MatchEventSelector
        mode={mode}
        eventId={eventId}
        events={eventsQuery.data}
        eventsLoading={eventsQuery.isLoading}
        onModeChange={setMode}
        onEventChange={setEventId}
      />

      <div className="space-y-4 xl:grid xl:grid-cols-[2fr_3fr] xl:items-start xl:gap-6 xl:space-y-0">
        {/* 場地（手機在上、xl 在右側） */}
        <Card className="xl:order-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span>場地</span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={toggleFocusMode}
                  title="專注模式"
                  aria-label="專注模式"
                >
                  <Expand className="h-5 w-5" />
                </Button>
                <TacticsToolbar
                  onCourtCount={courtPlayers.length}
                  totalCount={roster?.length ?? 0}
                  onClear={board.clearCourt}
                  drawingCount={drawingsBoard.drawings.length}
                  onClearDrawings={drawingsBoard.clearDrawings}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DrawingToolbar
              tool={tool}
              onToolChange={handleToolChange}
              style={drawingsBoard.style}
              onStyleChange={drawingsBoard.applyStyle}
              selectedId={selectedId}
              onDeleteSelected={() => selectedId && removeDrawing(selectedId)}
            />
            <VolleyballCourt
              courtPlayers={courtPlayers}
              courtRef={courtRef}
              rosterRef={rosterRef}
              onMovePlayer={board.movePlayer}
              onSwapPlayers={board.swapPlayers}
              onRemovePlayer={board.removePlayer}
              tool={tool}
              drawings={drawingsBoard.drawings}
              drawStyle={drawingsBoard.style}
              selectedDrawingId={selectedId}
              onAddDrawing={drawingsBoard.addDrawing}
              onUpdateDrawing={drawingsBoard.updateDrawing}
              onRemoveDrawing={removeDrawing}
              onSelectDrawing={drawingsBoard.selectDrawing}
              arrowEnabled={arrowEnabled}
            />
          </CardContent>
        </Card>

        {/* 球員名單（手機在下、xl 在左側） */}
        <div ref={rosterRef} className="xl:order-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-muted-foreground" />
                球員名單
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  {benchPlayers.length} 人
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerRoster
                players={benchPlayers}
                loading={rosterLoading}
                emptyHint={emptyHint}
                courtRef={courtRef}
                onDropToCourt={board.placePlayer}
                onQuickAdd={(p) =>
                  board.quickAddPlayer(p, courtRef.current?.getBoundingClientRect() ?? null)
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
