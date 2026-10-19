import { describe, expect, it } from "vitest";
import type { Point } from "./geometry";
import type { ReceiveSlot } from "./rotation";
import { checkOverlap } from "./overlap";

// R1：4=OH1 3=S 2=MB1 / 5=L 6=OPP 1=OH2
const legalR1 = (): Partial<Record<ReceiveSlot, Point>> => ({
  OH1: { x: 0.17, y: 0.1 },
  S: { x: 0.5, y: 0.1 },
  MB1: { x: 0.83, y: 0.1 },
  L: { x: 0.17, y: 0.6 },
  OPP: { x: 0.5, y: 0.6 },
  OH2: { x: 0.83, y: 0.6 },
});

describe("checkOverlap", () => {
  it("合法站位沒有違規", () => {
    expect(checkOverlap(1, legalR1())).toEqual([]);
  });

  it("前排左右錯位", () => {
    const f = { ...legalR1(), OH1: { x: 0.6, y: 0.1 } };
    const v = checkOverlap(1, f);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ a: "OH1", b: "S" });
    expect(v[0].message).toBe("4號位（主攻1）須在3號位（舉球）左側");
  });

  it("前後錯位（自由以 5 號位判斷）", () => {
    const f = { ...legalR1(), L: { x: 0.17, y: 0.05 } };
    const v = checkOverlap(1, f);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ a: "OH1", b: "L" });
    expect(v[0].message).toBe("4號位（主攻1）須比5號位（自由）靠近球網");
  });

  it("座標相等視為違規", () => {
    const f = { ...legalR1(), S: { x: 0.83, y: 0.1 } };
    expect(checkOverlap(1, f).some((x) => x.a === "S" && x.b === "MB1")).toBe(true);
  });

  it("缺少格子時略過該組判斷", () => {
    const f = legalR1();
    delete f.S;
    expect(checkOverlap(1, f)).toEqual([]);
  });
});
