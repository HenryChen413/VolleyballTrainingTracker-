import { describe, expect, it } from "vitest";
import type { RosterPlayer } from "@/lib/court";
import { assignPlayer, autoAssign, clearSlot } from "./lineup";
import { DEFENSE_SLOTS, DEFENSE_SLOT_META, RECEIVE_SLOTS, RECEIVE_SLOT_META, type DefenseSlot } from "./slots";

const p = (playerId: number, jerseyNo: number | null, position: string | null, name = `P${playerId}`): RosterPlayer => ({
  playerId, jerseyNo, name, position,
});

describe("autoAssign", () => {
  it("依主要位置與背號配對（主攻1 拿背號小的）", () => {
    const roster = [p(1, 12, "OH"), p(2, 3, "OH,OPP"), p(3, 7, "S"), p(4, 9, "MB"), p(5, 2, "MB"), p(6, 5, "L"), p(7, 8, "OPP")];
    const a = autoAssign(RECEIVE_SLOTS, RECEIVE_SLOT_META, roster);
    expect(a.OH1?.playerId).toBe(2);
    expect(a.OH2?.playerId).toBe(1);
    expect(a.MB1?.playerId).toBe(5);
    expect(a.MB2?.playerId).toBe(4);
    expect(a.S?.playerId).toBe(3);
    expect(a.L?.playerId).toBe(6);
    expect(a.OPP?.playerId).toBe(7);
  });

  it("人數不足或無位置的球員 → 該格留空（顯示代號），不塞錯位置的人", () => {
    const roster = [p(1, 1, "OH"), p(2, 2, null), p(3, 3, "")];
    const a = autoAssign(DEFENSE_SLOTS, DEFENSE_SLOT_META, roster);
    expect(a.OHF?.playerId).toBe(1);
    expect(a.OHB).toBeUndefined();
    expect(a.S).toBeUndefined();
    expect(Object.keys(a)).toEqual(["OHF"]);
  });

  it("背號為 null 的排最後，同背號依姓名", () => {
    const roster = [p(1, null, "OH", "甲"), p(2, 4, "OH", "乙")];
    const a = autoAssign(DEFENSE_SLOTS, DEFENSE_SLOT_META, roster);
    expect(a.OHF?.playerId).toBe(2);
    expect(a.OHB?.playerId).toBe(1);
  });
});

describe("assignPlayer / clearSlot", () => {
  it("選到已在別格的球員時兩格互換", () => {
    const x = p(1, 1, "OH");
    const y = p(2, 2, "OH");
    const n = assignPlayer<DefenseSlot>({ OHF: x, OHB: y }, "OHF", y);
    expect(n.OHF?.playerId).toBe(2);
    expect(n.OHB?.playerId).toBe(1);
  });

  it("原格為空時，被選走的那格清空", () => {
    const y = p(2, 2, "OH");
    const n = assignPlayer<DefenseSlot>({ OHB: y }, "OHF", y);
    expect(n).toEqual({ OHF: y });
  });

  it("clearSlot 清除該格", () => {
    expect(clearSlot({ OHF: p(1, 1, "OH") }, "OHF")).toEqual({});
  });
});
