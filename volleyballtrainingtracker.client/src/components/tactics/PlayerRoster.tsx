import { useRef, useState } from "react";
import { Users } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { clientToNorm, type RosterPlayer } from "@/lib/court";
import { POSITION_LABELS, primaryPosition } from "@/lib/positions";
import { roleTokenClass } from "./tokenStyle";

interface Props {
  /** 尚未上場的球員（已上場者由頁面先過濾掉） */
  players: RosterPlayer[];
  loading?: boolean;
  emptyHint: string;
  /** 場地容器 ref：拖曳放開時換算落點座標 */
  courtRef: React.RefObject<HTMLDivElement | null>;
  onDropToCourt: (player: RosterPlayer, x: number, y: number) => void;
  onQuickAdd: (player: RosterPlayer) => void;
}

/** 拖曳啟動門檻（px）：位移超過此值才視為拖曳，否則視為點選 */
const DRAG_THRESHOLD_PX = 8;

/**
 * 名單以 Grid 等分欄位排列：每張卡片寬度一致（與姓名長短無關）、每列數量固定，
 * 視覺整齊易掃描。欄數依容器寬度調整：手機 2 欄、平板（全寬堆疊）3 欄；
 * 桌機名單位於左側欄（約 430–560px），故 xl 為 2 欄、2xl 為 3 欄
 * —— 以欄寬換算等效於全寬版面的 4–5 欄。
 */
const ROSTER_GRID_CLASS = "grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3";

interface DragGhost {
  player: RosterPlayer;
  x: number;
  y: number;
}

/**
 * 球員名單：點選＝自動補位上場；拖曳到場地＝放在指定位置。
 * 手機版為底部橫向捲動列、xl 起為左側直欄（換行排列）。
 */
export default function PlayerRoster({
  players,
  loading,
  emptyHint,
  courtRef,
  onDropToCourt,
  onQuickAdd,
}: Props) {
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const pressRef = useRef<{ player: RosterPlayer; startX: number; startY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, player: RosterPlayer) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pressRef.current = { player, startX: e.clientX, startY: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press) return;
    if (
      ghost ||
      Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > DRAG_THRESHOLD_PX
    ) {
      setGhost({ player: press.player, x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (!press) return;

    if (!ghost) {
      // 沒有產生拖曳 → 視為點選：自動補到第一個空的輪轉位置
      onQuickAdd(press.player);
      return;
    }
    setGhost(null);
    const rect = courtRef.current?.getBoundingClientRect();
    if (
      rect &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      const norm = clientToNorm(rect, e.clientX, e.clientY);
      onDropToCourt(press.player, norm.x, norm.y);
    }
  };

  const handlePointerCancel = () => {
    pressRef.current = null;
    setGhost(null);
  };

  if (loading) {
    return (
      <div className={ROSTER_GRID_CLASS}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (players.length === 0) {
    return <EmptyState compact icon={Users} title="沒有可上場的球員" description={emptyHint} />;
  }

  return (
    <>
      {/* Grid 等分排列（所有斷點），不做橫向捲動；名單高度隨人數自然增長，不影響上方場地 */}
      <div className={ROSTER_GRID_CLASS}>
        {players.map((p) => {
          const role = primaryPosition(p.position);
          return (
            <button
              key={p.playerId}
              type="button"
              // pan-x：手指「往上滑」＝把球員拖向上方場地（交給 Pointer Events），
              // 拖曳體驗優先；頁面垂直捲動請從卡片邊緣或場地區起手。
              // 點選（無拖曳位移）＝自動補位上場，兩種上場方式並存。
              className={cn(
                "flex cursor-grab select-none items-center gap-2 rounded-lg border",
                "bg-card px-3 py-2 shadow-soft transition-colors hover:bg-accent",
                "[touch-action:pan-x]",
                ghost?.player.playerId === p.playerId && "opacity-40",
              )}
              onPointerDown={(e) => handlePointerDown(e, p)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              aria-label={`${p.name}（背號 ${p.jerseyNo ?? "無"}），點選上場或拖曳到場地`}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                  roleTokenClass(role),
                )}
              >
                {p.jerseyNo ?? "–"}
              </span>
              {/* min-w-0 讓 truncate 在等寬卡片內生效，內容不會撐寬卡片 */}
              <span className="flex min-w-0 flex-1 flex-col items-start">
                <span className="w-full truncate text-left text-sm font-medium">{p.name}</span>
                <span className="w-full truncate text-left text-[10px] text-muted-foreground">
                  {role ? (POSITION_LABELS[role] ?? role) : "未指定位置"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 拖曳中的浮動殘影（fixed 定位跟著指標，不受容器 overflow 裁切） */}
      {ghost && (
        <div
          className={cn(
            "pointer-events-none fixed z-50 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2",
            "flex-col items-center justify-center rounded-full opacity-90 shadow-lift",
            roleTokenClass(primaryPosition(ghost.player.position)),
          )}
          style={{ left: ghost.x, top: ghost.y }}
        >
          <span className="text-sm font-bold leading-none tabular-nums">
            {ghost.player.jerseyNo ?? "–"}
          </span>
          <span className="mt-0.5 max-w-[44px] truncate text-[10px] leading-none">
            {ghost.player.name}
          </span>
        </div>
      )}
    </>
  );
}
