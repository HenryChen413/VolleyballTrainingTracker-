import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ATTACK_LINE_OPP,
  ATTACK_LINE_OUR,
  COURT_RECT,
  COURT_VIEW,
  NET_Y,
  ROTATION_ANCHORS,
  clientToNorm,
  clientToViewNorm,
  type CourtPlayer,
} from "@/lib/court";
import {
  arrowSizeFor,
  distanceToDrawing,
  simplifyPoints,
  translatePoints,
  type Drawing,
  type DrawingPoint,
  type DrawingTool,
} from "@/lib/drawing";
import CourtPlayerToken from "./CourtPlayerToken";
import DrawingLayer from "./DrawingLayer";
import type { DrawingStyle } from "./useTacticsDrawings";

interface Props {
  courtPlayers: CourtPlayer[];
  /** 場地容器 ref（由頁面持有，名單拖入時也用它換算座標） */
  courtRef: React.RefObject<HTMLDivElement | null>;
  /** 名單區容器 ref：token 放開時若落在其上，視為「拖回名單區」移出場地 */
  rosterRef: React.RefObject<HTMLDivElement | null>;
  onMovePlayer: (playerId: number, x: number, y: number) => void;
  onSwapPlayers: (
    draggedId: number,
    targetId: number,
    draggedStart: { x: number; y: number },
  ) => void;
  onRemovePlayer: (playerId: number) => void;
  // ── 戰術畫線 ──
  tool: DrawingTool;
  drawings: Drawing[];
  drawStyle: DrawingStyle;
  selectedDrawingId: string | null;
  onAddDrawing: (d: Drawing) => void;
  onUpdateDrawing: (id: string, patch: Partial<Omit<Drawing, "id">>) => void;
  onRemoveDrawing: (id: string) => void;
  onSelectDrawing: (id: string | null) => void;
}

/** token 放開時，與另一名球員的距離小於此像素值即視為「交換位置」 */
const SWAP_RADIUS_PX = 40;
/** token 位移門檻（px）：超過才視為拖曳；以內視為輕點（雙點移除偵測用） */
const TAP_MOVE_THRESHOLD_PX = 6;
/** 兩次輕點間隔（ms）以內視為雙點 → 移出場地 */
const DOUBLE_TAP_MS = 350;
/** 自由曲線取樣間距（px）：移動超過此距離才記一點 */
const MIN_SAMPLE_PX = 6;
/** 線條最短長度（px）：低於此視為誤觸，不產生線 */
const MIN_COMMIT_PX = 12;
/** 橡皮擦命中半徑（px） */
const ERASE_RADIUS_PX = 16;

/**
 * 排球場地：SVG 畫場線（viewBox 自動 RWD），球員 token 用 HTML 絕對定位疊在上層，
 * 戰術線再以獨立 SVG 疊於 token 之上（根層 pointer-events:none，不干擾球員拖曳）。
 *
 * 圖層互動以「工具模式」硬隔離：
 * - 選取模式：球員可拖；線條可點選／整條拖移／拖端點。
 * - 畫線／橡皮擦模式：最上層蓋透明捕捉層（z-30, touch-none）接收所有 pointer
 *   事件，token 同時 pointer-events:none —— 畫線絕不會誤拖球員；
 *   切回選取模式即恢復頁面捲動與球員拖曳。
 */
export default function VolleyballCourt({
  courtPlayers,
  courtRef,
  rosterRef,
  onMovePlayer,
  onSwapPlayers,
  onRemovePlayer,
  tool,
  drawings,
  drawStyle,
  selectedDrawingId,
  onAddDrawing,
  onUpdateDrawing,
  onRemoveDrawing,
  onSelectDrawing,
}: Props) {
  // ── 球員拖曳 ──
  const [draggingId, setDraggingId] = useState<number | null>(null);
  // 起拖位置（交換時讓目標退回此處）、「指標、token 中心」偏移量、
  // 起拖的螢幕座標與是否已超過拖曳門檻（未超過＝輕點）
  const dragInfo = useRef<{
    start: { x: number; y: number };
    dx: number;
    dy: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);
  // 雙點移除：觸控雙點不會可靠觸發 dblclick（pointer capture + touch-action:none），
  // 改在 pointerup 自行偵測「同一球員、間隔內的兩次輕點」，滑鼠／觸控通用
  const lastTap = useRef<{ playerId: number; time: number } | null>(null);

  // ── 戰術線：繪製中預覽與選取拖曳 ──
  const [draft, setDraft] = useState<Drawing | null>(null);
  const drawingDrag = useRef<{
    id: string;
    mode: "move" | "endpoint";
    pointIndex?: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const erasing = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, p: CourtPlayer) => {
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    dragInfo.current = {
      start: { x: p.x, y: p.y },
      dx: p.x - nx,
      dy: p.y - ny,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };
    setDraggingId(p.playerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>, p: CourtPlayer) => {
    const info = dragInfo.current;
    if (draggingId !== p.playerId || !info) return;
    // 未超過門檻前不移動 token：輕點時不抖動，也保住雙點偵測
    if (!info.moved) {
      if (
        Math.hypot(e.clientX - info.startClientX, e.clientY - info.startClientY) <
        TAP_MOVE_THRESHOLD_PX
      ) {
        return;
      }
      info.moved = true;
    }
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    const norm = clientToNorm(rect, e.clientX, e.clientY);
    onMovePlayer(p.playerId, norm.x + info.dx, norm.y + info.dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>, p: CourtPlayer) => {
    const info = dragInfo.current;
    if (draggingId !== p.playerId || !info) return;
    const start = info.start;
    setDraggingId(null);
    dragInfo.current = null;

    // 0) 沒有拖曳位移 → 視為輕點：雙點（間隔內第二次）＝移出場地，
    //    且不進入下方的名單區／交換判定（避免重疊 token 被單點誤交換）
    if (!info.moved) {
      const now = e.timeStamp;
      if (
        lastTap.current &&
        lastTap.current.playerId === p.playerId &&
        now - lastTap.current.time < DOUBLE_TAP_MS
      ) {
        lastTap.current = null;
        onRemovePlayer(p.playerId);
      } else {
        lastTap.current = { playerId: p.playerId, time: now };
      }
      return;
    }

    // 1) 放開在名單區上 → 移出場地
    const rosterRect = rosterRef.current?.getBoundingClientRect();
    if (
      rosterRect &&
      e.clientX >= rosterRect.left &&
      e.clientX <= rosterRect.right &&
      e.clientY >= rosterRect.top &&
      e.clientY <= rosterRect.bottom
    ) {
      onRemovePlayer(p.playerId);
      return;
    }

    // 2) 放開在另一名球員附近 → 交換站位
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = courtPlayers.find(
      (q) =>
        q.playerId !== p.playerId &&
        Math.hypot((q.x - p.x) * rect.width, (q.y - p.y) * rect.height) < SWAP_RADIUS_PX,
    );
    if (target) onSwapPlayers(p.playerId, target.playerId, start);
  };

  const handlePointerCancel = (p: CourtPlayer) => {
    if (draggingId !== p.playerId || !dragInfo.current) return;
    // 拖曳被系統中斷（如來電、手勢衝突）：退回起拖位置
    onMovePlayer(p.playerId, dragInfo.current.start.x, dragInfo.current.start.y);
    setDraggingId(null);
    dragInfo.current = null;
  };

  // ── 橡皮擦：以幾何距離命中（不依賴 DOM hit-test），由上層往下找第一條 ──
  const eraseAt = (pt: DrawingPoint, rect: DOMRect) => {
    const viewPt = { x: pt.x * COURT_VIEW.w, y: pt.y * COURT_VIEW.h };
    // 場地等比縮放（aspect 固定），單一倍率即可把 px 門檻換成 viewBox 單位
    const scale = COURT_VIEW.w / rect.width;
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      if (distanceToDrawing(d, viewPt) <= ERASE_RADIUS_PX * scale + d.width / 2) {
        onRemoveDrawing(d.id);
        return;
      }
    }
  };

  // ── 繪圖捕捉層（畫線／橡皮擦模式）──
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = clientToViewNorm(rect, e.clientX, e.clientY);
    if (tool === "eraser") {
      erasing.current = true;
      eraseAt(pt, rect);
      return;
    }
    if (tool === "line" || tool === "arrow" || tool === "freehand") {
      setDraft({
        id: crypto.randomUUID(),
        kind: tool,
        color: drawStyle.color,
        width: drawStyle.width,
        arrowSize: tool === "arrow" ? arrowSizeFor(drawStyle.width) : undefined,
        points: tool === "freehand" ? [pt] : [pt, pt],
      });
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pt = clientToViewNorm(rect, e.clientX, e.clientY);
    if (tool === "eraser") {
      if (erasing.current) eraseAt(pt, rect);
      return;
    }
    if (!draft) return;
    if (draft.kind === "freehand") {
      const last = draft.points[draft.points.length - 1];
      const distPx = Math.hypot((pt.x - last.x) * rect.width, (pt.y - last.y) * rect.height);
      if (distPx < MIN_SAMPLE_PX) return;
      setDraft({ ...draft, points: [...draft.points, pt] });
    } else {
      setDraft({ ...draft, points: [draft.points[0], pt] });
    }
  };

  const handleCanvasPointerUp = () => {
    if (tool === "eraser") {
      erasing.current = false;
      return;
    }
    if (!draft) return;
    const rect = courtRef.current?.getBoundingClientRect();
    setDraft(null);
    if (!rect) return;

    if (draft.kind === "freehand") {
      const pts = simplifyPoints(draft.points);
      if (pts.length >= 2 && polylineLengthPx(pts, rect) >= MIN_COMMIT_PX) {
        onAddDrawing({ ...draft, points: pts });
      }
    } else {
      const [a, b] = draft.points;
      const lenPx = Math.hypot((b.x - a.x) * rect.width, (b.y - a.y) * rect.height);
      if (lenPx >= MIN_COMMIT_PX) onAddDrawing(draft);
    }
  };

  const handleCanvasPointerCancel = () => {
    erasing.current = false;
    setDraft(null);
  };

  // ── 選取模式：線條整條拖移／端點編輯（事件來自 DrawingLayer）──
  const handleDrawingPointerDown = (e: React.PointerEvent<SVGPathElement>, d: Drawing) => {
    if (tool !== "select") return;
    e.stopPropagation(); // 不要觸發容器的「點空白取消選取」
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = clientToViewNorm(rect, e.clientX, e.clientY);
    drawingDrag.current = { id: d.id, mode: "move", lastX: pt.x, lastY: pt.y };
    onSelectDrawing(d.id);
  };

  const handleHandlePointerDown = (
    e: React.PointerEvent<SVGCircleElement>,
    d: Drawing,
    idx: number,
  ) => {
    if (tool !== "select") return;
    e.stopPropagation();
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = clientToViewNorm(rect, e.clientX, e.clientY);
    drawingDrag.current = { id: d.id, mode: "endpoint", pointIndex: idx, lastX: pt.x, lastY: pt.y };
  };

  const handleDrawingPointerMove = (e: React.PointerEvent<SVGElement>) => {
    const drag = drawingDrag.current;
    if (!drag) return;
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pt = clientToViewNorm(rect, e.clientX, e.clientY); // 已夾在 viewBox 內
    const d = drawings.find((x) => x.id === drag.id);
    if (!d) return;
    if (drag.mode === "move") {
      onUpdateDrawing(d.id, {
        points: translatePoints(d.points, pt.x - drag.lastX, pt.y - drag.lastY),
      });
      drag.lastX = pt.x;
      drag.lastY = pt.y;
    } else {
      onUpdateDrawing(d.id, {
        points: d.points.map((p, i) => (i === drag.pointIndex ? pt : p)),
      });
    }
  };

  const handleDrawingPointerUp = () => {
    drawingDrag.current = null;
  };

  const drawingMode = tool !== "select";

  return (
    <div
      ref={courtRef}
      className="relative mx-auto aspect-[10/19] w-full max-w-[560px] select-none"
      // 選取模式下點場地空白處＝取消線條選取（線／端點的 down 已 stopPropagation）
      onPointerDown={() => {
        if (tool === "select") onSelectDrawing(null);
      }}
    >
      <svg
        viewBox={`0 0 ${COURT_VIEW.w} ${COURT_VIEW.h}`}
        className="h-full w-full rounded-lg"
        aria-hidden
      >
        {/* 場地底色：對方場區（上）／我方場區（下），前排再加一層強調 */}
        <rect
          x={COURT_RECT.x}
          y={COURT_RECT.y}
          width={COURT_RECT.w}
          height={COURT_RECT.h / 2}
          className="fill-muted/60"
        />
        <rect
          x={COURT_RECT.x}
          y={NET_Y}
          width={COURT_RECT.w}
          height={COURT_RECT.h / 2}
          className="fill-primary/5"
        />
        <rect
          x={COURT_RECT.x}
          y={NET_Y}
          width={COURT_RECT.w}
          height={ATTACK_LINE_OUR - NET_Y}
          className="fill-primary/10"
        />

        {/* 場線 */}
        <rect
          x={COURT_RECT.x}
          y={COURT_RECT.y}
          width={COURT_RECT.w}
          height={COURT_RECT.h}
          strokeWidth={8}
          className="fill-none stroke-foreground/50"
        />
        <line
          x1={COURT_RECT.x}
          y1={ATTACK_LINE_OPP}
          x2={COURT_RECT.x + COURT_RECT.w}
          y2={ATTACK_LINE_OPP}
          strokeWidth={6}
          className="stroke-foreground/35"
        />
        <line
          x1={COURT_RECT.x}
          y1={ATTACK_LINE_OUR}
          x2={COURT_RECT.x + COURT_RECT.w}
          y2={ATTACK_LINE_OUR}
          strokeWidth={6}
          className="stroke-foreground/35"
        />

        {/* 球網（中線）：粗線＋網柱＋白色虛線示意網面 */}
        <line
          x1={COURT_RECT.x - 20}
          y1={NET_Y}
          x2={COURT_RECT.x + COURT_RECT.w + 20}
          y2={NET_Y}
          strokeWidth={14}
          className="stroke-foreground/70"
        />
        <line
          x1={COURT_RECT.x - 20}
          y1={NET_Y}
          x2={COURT_RECT.x + COURT_RECT.w + 20}
          y2={NET_Y}
          strokeWidth={6}
          strokeDasharray="18 14"
          className="stroke-background"
        />
        <circle cx={COURT_RECT.x - 24} cy={NET_Y} r={13} className="fill-foreground/60" />
        <circle
          cx={COURT_RECT.x + COURT_RECT.w + 24}
          cy={NET_Y}
          r={13}
          className="fill-foreground/60"
        />

        {/* 區域標示 */}
        <text
          x={COURT_VIEW.w / 2}
          y={(COURT_RECT.y + NET_Y) / 2}
          fontSize={56}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground/40"
        >
          對方場區
        </text>
        <text
          x={COURT_RECT.x + COURT_RECT.w - 30}
          y={(NET_Y + ATTACK_LINE_OUR) / 2 - 110}
          fontSize={34}
          textAnchor="end"
          className="fill-muted-foreground/60"
        >
          前排
        </text>
        <text
          x={COURT_RECT.x + COURT_RECT.w - 30}
          y={(ATTACK_LINE_OUR + COURT_RECT.y + COURT_RECT.h) / 2 - 30}
          fontSize={34}
          textAnchor="end"
          className="fill-muted-foreground/60"
        >
          後排
        </text>

        {/* 六個輪轉位置錨點（4 3 2 / 5 6 1） */}
        {ROTATION_ANCHORS.map((a) => (
          <g key={a.pos}>
            <circle
              cx={a.x * COURT_VIEW.w}
              cy={a.y * COURT_VIEW.h}
              r={48}
              strokeWidth={4}
              strokeDasharray="10 10"
              className="fill-none stroke-border"
            />
            <text
              x={a.x * COURT_VIEW.w}
              y={a.y * COURT_VIEW.h}
              fontSize={40}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground/50"
            >
              {a.pos}
            </text>
          </g>
        ))}
      </svg>

      {/* 球員 token 疊層（HTML，中文排版與既有樣式較 SVG text 友善） */}
      {courtPlayers.map((p) => (
        <CourtPlayerToken
          key={p.playerId}
          player={p}
          dragging={draggingId === p.playerId}
          interactive={!drawingMode}
          onPointerDown={(e) => handlePointerDown(e, p)}
          onPointerMove={(e) => handlePointerMove(e, p)}
          onPointerUp={(e) => handlePointerUp(e, p)}
          onPointerCancel={() => handlePointerCancel(p)}
        />
      ))}

      {/* 戰術線疊層：z 介於一般 token（10）與拖曳中 token（20）之間，
          根 SVG 不收事件，只有線條命中區／端點在選取模式下開啟 */}
      <svg
        viewBox={`0 0 ${COURT_VIEW.w} ${COURT_VIEW.h}`}
        className="absolute inset-0 z-[15] h-full w-full"
        style={{ pointerEvents: "none" }}
      >
        <DrawingLayer
          drawings={drawings}
          draft={draft}
          selectedId={selectedDrawingId}
          interactive={tool === "select"}
          onDrawingPointerDown={handleDrawingPointerDown}
          onHandlePointerDown={handleHandlePointerDown}
          onDrawingPointerMove={handleDrawingPointerMove}
          onDrawingPointerUp={handleDrawingPointerUp}
        />
      </svg>

      {/* 繪圖捕捉層：畫線／橡皮擦模式時蓋在最上層，球員不可能被誤拖 */}
      {drawingMode && (
        <div
          className={cn(
            "absolute inset-0 z-30 touch-none",
            tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
          )}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerCancel}
        />
      )}
    </div>
  );
}

/** 折線總長（px），用於過濾過短的自由曲線 */
function polylineLengthPx(points: DrawingPoint[], rect: DOMRect): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(
      (points[i + 1].x - points[i].x) * rect.width,
      (points[i + 1].y - points[i].y) * rect.height,
    );
  }
  return len;
}
