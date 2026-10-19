import { describe, expect, it } from "vitest";
import { defaultDefenseLayout, defaultReceiveLayout, receiversFor } from "./defaults";
import { parseDefenseLayout, parseReceiveLayout, RECEIVE_SYSTEMS } from "./layout";
import { checkOverlap } from "./overlap";
import { onCourtSlots, ROTATIONS } from "./rotation";
import { DEFENSE_SLOTS } from "./slots";

describe("預設站位", () => {
  it("防守預設：兩組基本站位齊全、5 個情況", () => {
    const d = defaultDefenseLayout();
    for (const k of ["setterFront", "setterBack"] as const) {
      expect(Object.keys(d.bases[k]).sort()).toEqual([...DEFENSE_SLOTS].sort());
    }
    expect(d.situations.map((s) => s.name)).toEqual([
      "對方打4號位", "對方打2號位", "對方中間快攻", "對方吊球", "機會球",
    ]);
  });

  it("防守預設：舉球員前排與後排站法相同（只差前後排的看法）", () => {
    const d = defaultDefenseLayout();
    expect(d.bases.setterBack).toEqual(d.bases.setterFront);
    for (const s of d.situations) expect(s.positions.setterBack).toEqual(s.positions.setterFront);
  });

  it.each(RECEIVE_SYSTEMS.map((s) => s.key))("%s 預設接發站位全部合法且格子正確", (system) => {
    const l = defaultReceiveLayout(system);
    expect(l.rotations.map((r) => r.rotation)).toEqual([...ROTATIONS]);
    for (const r of l.rotations) {
      expect(Object.keys(r.receive).sort()).toEqual([...onCourtSlots(r.rotation)].sort());
      expect(Object.keys(r.attack).sort()).toEqual([...onCourtSlots(r.rotation)].sort());
      expect(checkOverlap(r.rotation, r.receive)).toEqual([]);
    }
  });

  it("舉對＋自由＋1大砲：接發者為副攻、自由、後排主攻", () => {
    // R1 後排主攻為 OH2（1 號位）
    expect([...receiversFor("receive-opp", 1)].sort()).toEqual(["L", "OH2", "OPP"]);
    expect([...receiversFor("receive-2oh", 1)].sort()).toEqual(["L", "OH1", "OH2"]);
  });
});

describe("parseDefenseLayout", () => {
  it("正常資料原樣保留", () => {
    const d = defaultDefenseLayout();
    expect(parseDefenseLayout(JSON.parse(JSON.stringify(d)))).toEqual({ layout: d, recovered: false });
  });

  it("null／版本錯誤／非物件 → 整套退回預設並標記 recovered", () => {
    for (const raw of [null, { version: 2 }, "x", []]) {
      const r = parseDefenseLayout(raw);
      expect(r.recovered).toBe(true);
      expect(r.layout).toEqual(defaultDefenseLayout());
    }
  });

  it("缺格以預設補、越界夾回、非數字以預設補", () => {
    const d = defaultDefenseLayout();
    const raw = JSON.parse(JSON.stringify(d));
    delete raw.bases.setterFront.S;
    raw.bases.setterFront.OPP = { x: 5, y: -1 };
    raw.bases.setterBack.MB = { x: "a", y: 0.2 };
    const r = parseDefenseLayout(raw);
    expect(r.recovered).toBe(false);
    expect(r.layout.bases.setterFront.S).toEqual(d.bases.setterFront.S);
    expect(r.layout.bases.setterFront.OPP).toEqual({ x: 1, y: 0 });
    expect(r.layout.bases.setterBack.MB).toEqual(d.bases.setterBack.MB);
  });

  it("名稱空白或過長的情況被略過；重複 id 重新產生", () => {
    const d = defaultDefenseLayout();
    const raw = JSON.parse(JSON.stringify(d));
    raw.situations[0].name = "   ";
    raw.situations[1].name = "一".repeat(21);
    raw.situations[3].id = raw.situations[2].id;
    const r = parseDefenseLayout(raw);
    expect(r.layout.situations.map((s) => s.name)).toEqual(["對方中間快攻", "對方吊球", "機會球"]);
    const ids = r.layout.situations.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("parseReceiveLayout", () => {
  it("正常資料原樣保留", () => {
    const l = defaultReceiveLayout("receive-2oh");
    expect(parseReceiveLayout(JSON.parse(JSON.stringify(l)), "receive-2oh")).toEqual({
      layout: l,
      recovered: false,
    });
  });

  it("缺輪轉補預設、多餘格子忽略", () => {
    const l = defaultReceiveLayout("receive-opp");
    const raw = JSON.parse(JSON.stringify(l));
    raw.rotations = raw.rotations.filter((r: { rotation: number }) => r.rotation !== 3);
    raw.rotations[0].receive.MB2 = { x: 0.5, y: 0.5 }; // R1 的 MB2 由自由替換，不在場上
    const r = parseReceiveLayout(raw, "receive-opp");
    expect(r.layout.rotations[2]).toEqual(l.rotations[2]);
    expect(r.layout.rotations[0].receive.MB2).toBeUndefined();
  });

  it("格式錯誤 → 預設＋recovered", () => {
    const r = parseReceiveLayout({ version: 1, rotations: "x" }, "receive-opp");
    expect(r.recovered).toBe(true);
    expect(r.layout).toEqual(defaultReceiveLayout("receive-opp"));
  });
});
