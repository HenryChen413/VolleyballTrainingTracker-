import { describe, it, expect } from 'vitest';
import {
  arrowHeadPathD,
  arrowSizeFor,
  distToSegment,
  distanceToDrawing,
  drawingPathD,
  simplifyPoints,
  translatePoints,
  type Drawing,
} from './drawing';

// viewBox 為 1000 × 1900（見 lib/court.ts），正規化座標 × 此倍率即 viewBox 座標
const make = (partial: Partial<Drawing>): Drawing => ({
  id: 't',
  kind: 'line',
  color: '#ef4444',
  width: 5.4,
  points: [],
  ...partial,
});

describe('drawingPathD', () => {
  it('直線：兩點產生 M/L 線段（viewBox 單位）', () => {
    const d = make({ points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }] });
    expect(drawingPathD(d)).toBe('M 0 0 L 500 950');
  });

  it('空點集回傳空字串', () => {
    expect(drawingPathD(make({}))).toBe('');
  });

  it('自由曲線 ≥3 點時用二次貝茲平滑（含 Q 指令）', () => {
    const d = make({
      kind: 'freehand',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.3 },
        { x: 0.4, y: 0.2 },
      ],
    });
    const path = drawingPathD(d);
    expect(path.startsWith('M 100 190')).toBe(true);
    expect(path).toContain('Q');
  });

  it('自由曲線僅 2 點時退回直線', () => {
    const d = make({ kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }] });
    expect(drawingPathD(d)).not.toContain('Q');
  });
});

describe('arrowHeadPathD', () => {
  it('水平箭頭：三角形 tip 在終點、以 Z 閉合', () => {
    const d = make({
      kind: 'arrow',
      points: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }],
    });
    const path = arrowHeadPathD(d);
    expect(path).not.toBeNull();
    expect(path!.startsWith('M 800 950')).toBe(true); // tip = (0.8*1000, 0.5*1900)
    expect(path!.endsWith('Z')).toBe(true);
    // 兩翼對稱於線軸（y=950），底邊 x = 800 - arrowSize
    const size = arrowSizeFor(5.4);
    expect(path).toContain(`${Math.round((800 - size) * 10) / 10}`);
  });

  it('非 arrow 或零長度時回傳 null', () => {
    expect(arrowHeadPathD(make({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }))).toBeNull();
    expect(
      arrowHeadPathD(make({ kind: 'arrow', points: [{ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 }] })),
    ).toBeNull();
  });
});

describe('distToSegment', () => {
  it('垂直投影落在線段內：取垂距', () => {
    expect(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('投影落在線段外：取到端點的距離', () => {
    expect(distToSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });

  it('零長度線段：取點距', () => {
    expect(distToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('distanceToDrawing', () => {
  it('取各線段最短距離（viewBox 單位）', () => {
    const d = make({
      kind: 'freehand',
      points: [
        { x: 0.1, y: 0.1 },   // (100, 190)
        { x: 0.5, y: 0.1 },   // (500, 190)
        { x: 0.5, y: 0.5 },   // (500, 950)
      ],
    });
    // 點 (300, 200) 距第一段（y=190 水平線）僅 10
    expect(distanceToDrawing(d, { x: 300, y: 200 })).toBeCloseTo(10);
  });

  it('空點集回傳 Infinity', () => {
    expect(distanceToDrawing(make({}), { x: 0, y: 0 })).toBe(Infinity);
  });
});

describe('simplifyPoints', () => {
  it('共線的中間點會被移除', () => {
    const pts = [0, 0.1, 0.2, 0.3, 0.4].map((x) => ({ x, y: 0.5 }));
    expect(simplifyPoints(pts)).toEqual([
      { x: 0, y: 0.5 },
      { x: 0.4, y: 0.5 },
    ]);
  });

  it('明顯的彎折點會被保留', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ];
    expect(simplifyPoints(pts)).toEqual(pts);
  });

  it('2 點以下原樣回傳', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(simplifyPoints(pts)).toEqual(pts);
  });
});

describe('translatePoints', () => {
  it('一般平移：所有點同步位移', () => {
    const [p] = translatePoints([{ x: 0.2, y: 0.2 }], 0.1, -0.1);
    expect(p.x).toBeCloseTo(0.3);
    expect(p.y).toBeCloseTo(0.1);
  });

  it('位移會被夾住，所有點不出界', () => {
    const out = translatePoints([{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }], 0.9, 0);
    // pad 預設 0（與畫線的 clampToView 一致）：maxX=0.7 → 最多再 +0.3
    expect(out[1].x).toBeCloseTo(1);
    expect(out[0].x).toBeCloseTo(0.8);
  });

  it('可平移到 viewBox 邊緣（畫得到的位置就拖得到）', () => {
    const out = translatePoints([{ x: 0.99, y: 0.5 }], 0.5, 0);
    expect(out[0].x).toBeCloseTo(1);
  });

  it('仍可用 pad 保留邊距', () => {
    const out = translatePoints([{ x: 0.5, y: 0.5 }], 0.9, 0, 0.01);
    expect(out[0].x).toBeCloseTo(0.99);
  });

  it('無有效位移時回傳原陣列（identity）', () => {
    // 已貼齊右緣，再往右推不動 → 同一個陣列參考
    const pts = [{ x: 1, y: 0.5 }];
    expect(translatePoints(pts, 0.5, 0)).toBe(pts);
  });
});
