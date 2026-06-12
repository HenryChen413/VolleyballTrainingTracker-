import { COURT_VIEW } from "@/lib/court";
import { arrowHeadPathD, drawingPathD, type Drawing } from "@/lib/drawing";

/** 隱形加粗命中描邊寬度（viewBox 單位，約 16px）：細線與手指都點得到 */
const HIT_STROKE_WIDTH = 28;
/** 端點控制點：顯示半徑與（更大的）隱形命中半徑 */
const HANDLE_RADIUS = 18;
const HANDLE_HIT_RADIUS = 36;

interface Props {
  drawings: Drawing[];
  /** 繪製中的預覽線（尚未 commit） */
  draft: Drawing | null;
  selectedId: string | null;
  /** 僅選取模式下線條可被點選／拖曳 */
  interactive: boolean;
  onDrawingPointerDown: (e: React.PointerEvent<SVGPathElement>, d: Drawing) => void;
  onHandlePointerDown: (e: React.PointerEvent<SVGCircleElement>, d: Drawing, idx: number) => void;
  /** 拖曳中／放開：pointer capture 後事件會回到按下的元素上，統一轉發 */
  onDrawingPointerMove: (e: React.PointerEvent<SVGElement>) => void;
  onDrawingPointerUp: (e: React.PointerEvent<SVGElement>) => void;
}

/**
 * 戰術線渲染層（掛在球員 token 之上的獨立 SVG 內）：
 * 每條線 = 可見線身（path）＋箭頭三角（path）＋隱形加粗命中區（path）；
 * 選取中再加高亮描邊與端點控制點（line/arrow）。
 * 根 SVG 為 pointer-events:none，只有命中區／控制點在選取模式下開啟事件，
 * 因此繪圖層不會干擾球員拖曳。
 */
export default function DrawingLayer({
  drawings,
  draft,
  selectedId,
  interactive,
  onDrawingPointerDown,
  onHandlePointerDown,
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
              strokeWidth={HIT_STROKE_WIDTH}
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
            {/* 端點控制點（選取中的直線／箭頭）：拖曳改起點／終點 */}
            {selected &&
              d.kind !== "freehand" &&
              d.points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x * COURT_VIEW.w}
                    cy={p.y * COURT_VIEW.h}
                    r={HANDLE_RADIUS}
                    className="fill-background"
                    stroke={d.color}
                    strokeWidth={5}
                  />
                  <circle
                    cx={p.x * COURT_VIEW.w}
                    cy={p.y * COURT_VIEW.h}
                    r={HANDLE_HIT_RADIUS}
                    fill="transparent"
                    style={{
                      pointerEvents: interactive ? "auto" : "none",
                      cursor: "grab",
                      touchAction: "none",
                    }}
                    onPointerDown={(e) => onHandlePointerDown(e, d, i)}
                    onPointerMove={onDrawingPointerMove}
                    onPointerUp={onDrawingPointerUp}
                    onPointerCancel={onDrawingPointerUp}
                  />
                </g>
              ))}
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
