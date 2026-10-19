import { describe, expect, it } from "vitest";
import { defaultDefenseLayout, defaultReceiveLayout } from "./defaults";
import {
  addSituation,
  BASE_FRAME_ID,
  copyDefenseFrameToOtherBase,
  moveSituation,
  removeSituation,
  renameSituation,
  resetSituationFromBase,
  setDefensePoint,
  setReceivePoint,
} from "./ops";

describe("防守編輯操作", () => {
  it("改基本站位只動該組該格，不影響情況", () => {
    const l = defaultDefenseLayout();
    const n = setDefensePoint(l, "setterFront", BASE_FRAME_ID, "S", { x: 0.1, y: 0.1 });
    expect(n.bases.setterFront.S).toEqual({ x: 0.1, y: 0.1 });
    expect(n.bases.setterBack).toEqual(l.bases.setterBack);
    expect(n.situations).toEqual(l.situations);
    expect(l.bases.setterFront.S).not.toEqual({ x: 0.1, y: 0.1 }); // 不可變更原物件
  });

  it("改情況只動該情況該組", () => {
    const l = defaultDefenseLayout();
    const id = l.situations[1].id;
    const n = setDefensePoint(l, "setterBack", id, "L", { x: 0.3, y: 0.3 });
    expect(n.situations[1].positions.setterBack.L).toEqual({ x: 0.3, y: 0.3 });
    expect(n.situations[1].positions.setterFront).toEqual(l.situations[1].positions.setterFront);
    expect(n.situations[0]).toEqual(l.situations[0]);
  });

  it("新增情況：trim、複製兩組基本站位、加在最後", () => {
    const l = defaultDefenseLayout();
    const res = addSituation(l, "  對方後排攻擊 ");
    expect(res).not.toBeNull();
    const added = res!.layout.situations.at(-1)!;
    expect(added).toMatchObject({ id: res!.id, name: "對方後排攻擊" });
    expect(added.positions).toEqual(l.bases);
    expect(added.positions.setterFront).not.toBe(l.bases.setterFront);
  });

  it.each(["", "   ", "一".repeat(21)])("名稱 %j 無效：新增與改名皆拒絕", (bad) => {
    const l = defaultDefenseLayout();
    expect(addSituation(l, bad)).toBeNull();
    expect(renameSituation(l, l.situations[0].id, bad)).toBeNull();
  });

  it("改名、刪除、移動", () => {
    const l = defaultDefenseLayout();
    const [a, b] = l.situations;
    expect(renameSituation(l, a.id, "新名稱")!.situations[0].name).toBe("新名稱");
    expect(removeSituation(l, a.id).situations.map((s) => s.id)).not.toContain(a.id);
    expect(moveSituation(l, b.id, -1).situations.slice(0, 2).map((s) => s.id)).toEqual([b.id, a.id]);
    expect(moveSituation(l, a.id, -1)).toEqual(l); // 已在最前不動
  });

  it("從基本站位重新套用：只覆寫該情況該組", () => {
    const l = defaultDefenseLayout();
    const id = l.situations[0].id;
    const n = resetSituationFromBase(l, id, "setterFront");
    expect(n.situations[0].positions.setterFront).toEqual(l.bases.setterFront);
    expect(n.situations[0].positions.setterBack).toEqual(l.situations[0].positions.setterBack);
  });
});

describe("套用到另一組（舉球員前排／後排）", () => {
  // 球隊打法：不論舉球員前排或後排，防守站法相同 → 照格子名稱直接複製，不對調舉球／副攻
  it("基本站位：每一格照名稱複製到另一組", () => {
    const l = defaultDefenseLayout();
    const src = { ...l.bases.setterFront, OHF: { x: 0.11, y: 0.22 }, S: { x: 0.8, y: 0.05 }, OPP: { x: 0.9, y: 0.7 } };
    const withSrc = { ...l, bases: { ...l.bases, setterFront: src } };
    const n = copyDefenseFrameToOtherBase(withSrc, BASE_FRAME_ID, "setterFront");
    expect(n.bases.setterBack).toEqual(src);
    expect(n.bases.setterBack.S).not.toBe(src.S); // 複製值而非共用參考
    expect(n.bases.setterFront).toEqual(src); // 來源不變
    expect(n.situations).toEqual(withSrc.situations); // 其他影格不變
  });

  it("情況：只動該情況的目標組，反方向（後排 → 前排）同樣照名稱複製", () => {
    const l = defaultDefenseLayout();
    const [a, b] = l.situations;
    const changed = { ...b.positions.setterBack, S: { x: 0.3, y: 0.3 } };
    const withB = { ...l, situations: [a, { ...b, positions: { ...b.positions, setterBack: changed } }, ...l.situations.slice(2)] };
    const n = copyDefenseFrameToOtherBase(withB, b.id, "setterBack");
    expect(n.situations[1].positions.setterFront).toEqual(changed);
    expect(n.situations[1].positions.setterBack).toEqual(changed);
    expect(n.situations[0]).toEqual(a);
    expect(n.bases).toEqual(l.bases);
  });

  it("找不到情況 id 時原樣回傳", () => {
    const l = defaultDefenseLayout();
    expect(copyDefenseFrameToOtherBase(l, "nope", "setterFront")).toEqual(l);
  });
});

describe("接發編輯操作", () => {
  it("只動指定輪轉與影格", () => {
    const l = defaultReceiveLayout("receive-oh1-opp");
    const n = setReceivePoint(l, 2, "attack", "S", { x: 0.7, y: 0.02 });
    expect(n.rotations[1].attack.S).toEqual({ x: 0.7, y: 0.02 });
    expect(n.rotations[1].receive).toEqual(l.rotations[1].receive);
    expect(n.rotations[0]).toEqual(l.rotations[0]);
  });
});
