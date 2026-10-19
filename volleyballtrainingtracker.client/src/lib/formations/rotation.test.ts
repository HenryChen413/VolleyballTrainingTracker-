import { describe, expect, it } from "vitest";
import {
  isSetterFrontRow,
  liberoReplaces,
  onCourtSlots,
  rotationLabel,
  rotationLineup,
  setterPosition,
  ROTATIONS,
} from "./rotation";

describe("rotation", () => {
  it("R1 依球隊排法：1=OH2 2=MB1 3=S 4=OH1 5=自由(替 MB2) 6=OPP", () => {
    expect(rotationLineup(1)).toEqual({ 1: "OH2", 2: "MB1", 3: "S", 4: "OH1", 5: "L", 6: "OPP" });
  });

  it("R2 順時針輪轉一格：攔中1 輪到 1 號位（後排）由自由替換", () => {
    expect(rotationLineup(2)).toEqual({ 1: "L", 2: "S", 3: "OH1", 4: "MB2", 5: "OPP", 6: "OH2" });
  });

  it("R3 後排攔中 MB1 由自由替換", () => {
    expect(rotationLineup(3)).toEqual({ 1: "S", 2: "OH1", 3: "MB2", 4: "OPP", 5: "OH2", 6: "L" });
  });

  it("舉球員號位依序為 3,2,1,6,5,4", () => {
    expect(ROTATIONS.map(setterPosition)).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it("舉球員前排：R1、R2、R6", () => {
    expect(ROTATIONS.map(isSetterFrontRow)).toEqual([true, true, false, false, false, true]);
  });

  it("自由替換的攔中", () => {
    expect(ROTATIONS.map(liberoReplaces)).toEqual(["MB2", "MB1", "MB1", "MB1", "MB2", "MB2"]);
  });

  it("每輪轉場上 6 格且含自由、不含被替換的攔中", () => {
    for (const r of ROTATIONS) {
      const slots = onCourtSlots(r);
      expect(slots).toHaveLength(6);
      expect(slots).toContain("L");
      expect(slots).not.toContain(liberoReplaces(r));
    }
  });

  it("輪轉標籤", () => {
    expect(rotationLabel(1)).toBe("R1（舉球在3號位）");
    expect(rotationLabel(4)).toBe("R4（舉球在6號位）");
  });
});
