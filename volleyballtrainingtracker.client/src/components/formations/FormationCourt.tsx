import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { roleTokenClass } from "@/components/tactics/tokenStyle";
import {
  ATTACK_LINE_Y,
  END_LINE_Y,
  HALF_VIEW,
  fromContainerFraction,
  toPercent,
  toView,
  type Point,
} from "@/lib/formations/geometry";

export interface CourtToken {
  key: string;
  /** 位置代碼（OH/OPP/MB/S/L），決定配色 */
  role: string;
  /** 主文字：背號或位置代號 */
  primary: string;
  /** 副文字：球員姓名（未帶入陣容時省略） */
  secondary?: string;
  point: Point;
}

interface Props {
  tokens: CourtToken[];
  /** 起始位置（淡色虛線圈＋箭頭）；與目前位置幾乎相同者不畫 */
  ghosts?: Partial<Record<string, Point>>;
  violations?: ReadonlyArray<{ a: Point; b: Point }>;
  editable: boolean;
  onMove?: (key: string, p: Point) => void;
  onTokenClick?: (key: string) => void;
  className?: string;
}

const MOVED_EPS = 0.02;

/**
 * 我方半場（球網在上）＋球員 token。
 * 切換影格時 token 以 left/top transition（0.5s）滑到新位置；拖曳中關閉 transition 以免延遲。
 * 編輯模式才可拖曳（token 加 touch-none，場地空白處仍可捲動頁面）。
 */
export default function FormationCourt({
  tokens,
  ghosts,
  violations,
  editable,
  onMove,
  onTokenClick,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const pointFromEvent = (e: React.PointerEvent): Point | null => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return fromContainerFraction(0, 0);
    return fromContainerFraction((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  const tl = toView({ x: 0, y: 0 });
  const br = toView({ x: 1, y: END_LINE_Y });
  const attackY = toView({ x: 0, y: ATTACK_LINE_Y }).y;

  return (
    <div
      ref={ref}
      className={cn("relative w-full select-none", className)}
      style={{ aspectRatio: `${HALF_VIEW.w} / ${HALF_VIEW.h}` }}
    >
      <svg
        viewBox={`0 0 ${HALF_VIEW.w} ${HALF_VIEW.h}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <marker id="formation-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="fill-foreground/60" />
          </marker>
        </defs>
        <rect x={0} y={0} width={HALF_VIEW.w} height={HALF_VIEW.h} className="fill-muted/60" />
        <rect x={tl.x} y={tl.y} width={br.x - tl.x} height={br.y - tl.y} className="fill-primary/5 stroke-foreground/50" strokeWidth={6} />
        <line x1={tl.x} y1={attackY} x2={br.x} y2={attackY} className="stroke-foreground/35" strokeWidth={4} strokeDasharray="16 12" />
        {/* 球網 */}
        <line x1={0} y1={tl.y} x2={HALF_VIEW.w} y2={tl.y} className="stroke-foreground/70" strokeWidth={10} />

        {tokens.map((t) => {
          const g = ghosts?.[t.key];
          if (!g || Math.hypot(g.x - t.point.x, g.y - t.point.y) < MOVED_EPS) return null;
          const a = toView(g);
          const b = toView(t.point);
          return (
            <g key={`ghost-${t.key}`}>
              <circle cx={a.x} cy={a.y} r={30} className="fill-none stroke-foreground/40" strokeWidth={4} strokeDasharray="8 6" />
              <line
                data-arrow
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="stroke-foreground/60"
                strokeWidth={5}
                markerEnd="url(#formation-arrow)"
              />
            </g>
          );
        })}

        {violations?.map((v, i) => {
          const a = toView(v.a);
          const b = toView(v.b);
          return (
            <line key={`v-${i}`} data-violation x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-destructive" strokeWidth={8} />
          );
        })}
      </svg>

      {tokens.map((t) => {
        const pos = toPercent(t.point);
        const dragging = dragKey === t.key;
        const label = t.secondary ? `${t.primary} ${t.secondary}` : t.primary;
        return (
          <button
            key={t.key}
            type="button"
            aria-label={label}
            className={cn(
              "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full shadow-lift",
              roleTokenClass(t.role),
              editable ? "z-20 touch-none cursor-grab" : "z-10",
              dragging ? "z-30 scale-110 cursor-grabbing ring-2 ring-ring" : "transition-[left,top] duration-500 ease-in-out",
            )}
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            onClick={() => {
              if (!editable) onTokenClick?.(t.key);
            }}
            onPointerDown={(e) => {
              if (!editable) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setDragKey(t.key);
            }}
            onPointerMove={(e) => {
              if (dragKey !== t.key) return;
              const p = pointFromEvent(e);
              if (p) onMove?.(t.key, p);
            }}
            onPointerUp={() => setDragKey(null)}
            onPointerCancel={() => setDragKey(null)}
          >
            <span className={cn("font-bold leading-none", t.secondary ? "text-sm tabular-nums" : "text-[11px]")}>
              {t.primary}
            </span>
            {t.secondary && (
              <span className="mt-0.5 max-w-[44px] truncate text-[10px] leading-none">{t.secondary}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
