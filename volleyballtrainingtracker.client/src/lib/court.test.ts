import { describe, expect, it } from 'vitest';
import { clampToCourt, clampToView, clientToNorm, clientToViewNorm, fitCourtSize } from './court';

/** 場地容器：aspect-[10/19]，取 500×950 對應 viewBox 1000×1900 */
const rect = { left: 100, top: 200, width: 500, height: 950 } as DOMRect;

describe('clampToCourt（球員 token）', () => {
  it('夾在場線範圍內', () => {
    expect(clampToCourt(-1, -1)).toEqual({ x: 0.05, y: 0.03 });
    expect(clampToCourt(2, 2)).toEqual({ x: 0.95, y: 0.97 });
  });

  it('範圍內的座標原樣回傳', () => {
    expect(clampToCourt(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('clampToView（戰術線）', () => {
  it('夾在整個 viewBox 內（含四周緩衝區）', () => {
    expect(clampToView(-1, -1)).toEqual({ x: 0, y: 0 });
    expect(clampToView(2, 2)).toEqual({ x: 1, y: 1 });
  });

  it('允許場線之外、球員到不了的位置（發球、界外球路線）', () => {
    // 端線後與邊線外：clampToCourt 會被夾掉，clampToView 保留
    expect(clampToView(0.02, 0.01)).toEqual({ x: 0.02, y: 0.01 });
    expect(clampToCourt(0.02, 0.01)).toEqual({ x: 0.05, y: 0.03 });
  });
});

describe('clientToNorm / clientToViewNorm', () => {
  it('容器內同一點換算結果相同', () => {
    expect(clientToNorm(rect, 350, 675)).toEqual({ x: 0.5, y: 0.5 });
    expect(clientToViewNorm(rect, 350, 675)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('靠近容器邊緣時兩者夾取範圍不同', () => {
    // 容器左上角
    expect(clientToNorm(rect, 100, 200)).toEqual({ x: 0.05, y: 0.03 });
    expect(clientToViewNorm(rect, 100, 200)).toEqual({ x: 0, y: 0 });
  });

  it('超出容器外的指標座標仍被夾在範圍內', () => {
    expect(clientToViewNorm(rect, -999, -999)).toEqual({ x: 0, y: 0 });
    expect(clientToViewNorm(rect, 9999, 9999)).toEqual({ x: 1, y: 1 });
  });
});

describe('fitCourtSize', () => {
  it('高度受限時以高度為準，維持 10:19 比例', () => {
    const { width, height } = fitCourtSize(400, 600);
    expect(height).toBeCloseTo(600);
    expect(width).toBeCloseTo((600 * 10) / 19);
    expect(height / width).toBeCloseTo(1.9);
  });

  it('寬度受限時以寬度為準，維持 10:19 比例', () => {
    const { width, height } = fitCourtSize(200, 900);
    expect(width).toBeCloseTo(200);
    expect(height).toBeCloseTo(380);
  });

  it('結果永遠塞得進可用空間', () => {
    for (const [w, h] of [[375, 650], [768, 1000], [1024, 700], [300, 300]]) {
      const r = fitCourtSize(w, h);
      expect(r.width).toBeLessThanOrEqual(w + 0.001);
      expect(r.height).toBeLessThanOrEqual(h + 0.001);
    }
  });

  it('可用空間為 0 時回傳 0，不產生 NaN', () => {
    expect(fitCourtSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
