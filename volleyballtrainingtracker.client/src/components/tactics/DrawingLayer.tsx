import { COURT_VIEW } from "@/lib/court";
import { arrowHeadPathD, drawingPathD, type Drawing } from "@/lib/drawing";

/** 端點控制點：顯示半徑（固定值，非命中區） */
const HANDLE_RADIUS = 18;

interface Props {
  drawings: Drawing[];
  /** 繪製中的預覽線（尚未 commit） */
  draft: Drawing | null;
  selectedId: string | null;
  /** 僅選取模式下線條可被點選／拖曳 */
  interactive: boolean;
  /** 線條隱形命中區描邊寬度（viewBox 單位），由場地實際寬度換算 */
  hitStrokeWidth: number;
  onDrawingPointerDown: (e: React.PointerEvent<SVGPathElement>, d: Drawing) => void;
  /** 拖曳中／放開：pointer capture 後事件會回到按下的元素上，統一轉發 */
  onDrawingPointerMove: (e: React.PointerEvent<SVGElement>) => void;
  onDrawingPointerUp: (e: React.PointerEvent<SVGElement>) => void;
}

/**
 * 戰術線「線身」渲染層：可見線身（path）＋箭頭三角（path）＋隱形加粗命中區（path）
 * ＋選取中的高亮描邊。**不含端點控制點**——端點另由 {@link DrawingHandlesLayer}
 * 負責，兩者故意分成兩個獨立 SVG 疊層渲染（見 VolleyballCourt 的 z-index 安排）：
 * 命中帶寬達螢幕 44px，若跟球員 token 疊在同一層就會蓋住 token 讓人拖不動；
 * 但端點是使用者選取後明確要拖的目標，即使端點剛好落在球員身上也必須拖得到，
 * 因此端點層需要疊在 token 之上，線身層則必須留在 token 之下。
 * 根 SVG 為 pointer-events:none，只有命中區在選取模式下開啟事件，
 * 因此繪圖層不會干擾球員拖曳。
 */
export default function DrawingLayer({
  drawings,
  draft,
  selectedId,
  interactive,
  hitStrokeWidth,
  onDrawingPointerDown,
  onDrawingPointerMove,
  onDrawingPointerUp,
}: Props) {
  return (
    <>
      {drawings.map((d) => {
        const pathD = drawingPathD(d);
        const arrowD = arrowHeadPathD(d);
        const selected = d.id === selectedId;
        return (
          <g key={d.id}>
            {/* 選取高亮：同色半透明加粗描邊 */}
            {selected && (
              <path
                d={pathD}
                stroke={d.color}
                strokeOpacity={0.25}
                strokeWidth={d.width * 2.5 + 10}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            {/* 線身 */}
            <path
              d={pathD}
              stroke={d.color}
              strokeWidth={d.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* 箭頭三角（顯式繪製，不用 marker） */}
            {arrowD && <path d={arrowD} fill={d.color} stroke="none" />}
            {/* 隱形加粗命中區：選取模式下可點選／整條拖曳 */}
            <path
              d={pathD}
              stroke="transparent"
              strokeWidth={hitStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{
                pointerEvents: interactive ? "stroke" : "none",
                cursor: "move",
                touchAction: "none",
              }}
              onPointerDown={(e) => onDrawingPointerDown(e, d)}
              onPointerMove={onDrawingPointerMove}
              onPointerUp={onDrawingPointerUp}
              onPointerCancel={onDrawingPointerUp}
            />
          </g>
        );
      })}

      {/* 繪製中預覽 */}
      {draft && (
        <g>
          <path
            d={drawingPathD(draft)}
            stroke={draft.color}
            strokeWidth={draft.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {(() => {
            const arrowD = arrowHeadPathD(draft);
            return arrowD ? <path d={arrowD} fill={draft.color} stroke="none" /> : null;
          })()}
        </g>
      )}
    </>
  );
}

interface HandlesProps {
  drawings: Drawing[];
  selectedId: string | null;
  /** 僅選取模式下端點可被拖曳 */
  interactive: boolean;
  /** 端點控制點命中半徑（viewBox 單位），由場地實際寬度換算 */
  handleHitRadius: number;
  onHandlePointerDown: (e: React.PointerEvent<SVGCircleElement>, d: Drawing, idx: number) => void;
  /** 拖曳中／放開：pointer capture 後事件會回到按下的元素上，統一轉發 */
  onDrawingPointerMove: (e: React.PointerEvent<SVGElement>) => void;
  onDrawingPointerUp: (e: React.PointerEvent<SVGElement>) => void;
}

/**
 * 戰術線「端點控制點」渲染層：只畫目前選取中的線（`points.length === 2`
 * 才有端點；舊草稿退化的多點折線不提供端點拖曳）。獨立於 {@link DrawingLayer}
 * 之外是刻意設計——見上方線身層註解；由 VolleyballCourt 疊在球員 token 之上，
 * 端點落在球員身上時仍優先可拖。同一份 `drawings`／`selectedId` 只在此找出選取
 * 中的那一筆（O(n) 查找，不涉及路徑字串計算），不會與線身層重算 pathD／arrowD。
 */
export function DrawingHandlesLayer({
  drawings,
  selectedId,
  interactive,
  handleHitRadius,
  onHandlePointerDown,
  onDrawingPointerMove,
  onDrawingPointerUp,
}: HandlesProps) {
  const selected = drawings.find((d) => d.id === selectedId);
  if (!selected || selected.points.length !== 2) return null;
  return (
    <>
      {selected.points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x * COURT_VIEW.w}
            cy={p.y * COURT_VIEW.h}
            r={HANDLE_RADIUS}
            className="fill-background"
            stroke={selected.color}
            strokeWidth={5}
          />
          <circle
            cx={p.x * COURT_VIEW.w}
            cy={p.y * COURT_VIEW.h}
            r={handleHitRadius}
            fill="transparent"
            style={{
              pointerEvents: interactive ? "auto" : "none",
              cursor: "grab",
              touchAction: "none",
            }}
            onPointerDown={(e) => onHandlePointerDown(e, selected, i)}
            onPointerMove={onDrawingPointerMove}
            onPointerUp={onDrawingPointerUp}
            onPointerCancel={onDrawingPointerUp}
          />
        </g>
      ))}
    </>
  );
}
