import { describe, expect, it } from "vitest";
import { clampPoint, fromContainerFraction, toPercent } from "./geometry";

describe("formations geometry", () => {
  it("左上角（網前左邊線）對應容器內的緩衝區偏移", () => {
    const p = toPercent({ x: 0, y: 0 });
    expect(p.left).toBeCloseTo(5);
    expect(p.top).toBeCloseTo((50 / 1150) * 100);
  });

  it("容器位置可來回換算", () => {
    const { left, top } = toPercent({ x: 0.3, y: 0.6 });
    const back = fromContainerFraction(left / 100, top / 100);
    expect(back.x).toBeCloseTo(0.3);
    expect(back.y).toBeCloseTo(0.6);
  });

  it("拖到場外時夾回 [0,1]", () => {
    expect(fromContainerFraction(-1, 2)).toEqual({ x: 0, y: 1 });
  });

  it("NaN／Infinity 座標夾成 0，不得產生 NaN", () => {
    expect(clampPoint({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({ x: 0, y: 0 });
  });
});
