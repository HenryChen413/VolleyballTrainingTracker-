// 站位編輯的純函式（不可變更新），頁面以 useFormation().update(fn) 套用。
import type { Point } from "./geometry";
import {
  newSituationId,
  SITUATION_NAME_MAX,
  type DefenseBaseKey,
  type DefenseFrame,
  type DefenseLayout,
  type ReceiveFrameKey,
  type ReceiveLayout,
} from "./layout";
import type { ReceiveSlot, RotationNo } from "./rotation";
import type { DefenseSlot } from "./slots";

/** 防守頁「基本站位」的影格 id（情況 id 由 newSituationId 產生，不會撞到） */
export const BASE_FRAME_ID = "base";

export function normalizeSituationName(name: string): string | null {
  const t = name.trim();
  return t && t.length <= SITUATION_NAME_MAX ? t : null;
}

export function setDefensePoint(
  l: DefenseLayout,
  base: DefenseBaseKey,
  frameId: string,
  slot: DefenseSlot,
  p: Point,
): DefenseLayout {
  if (frameId === BASE_FRAME_ID) {
    return { ...l, bases: { ...l.bases, [base]: { ...l.bases[base], [slot]: p } } };
  }
  return {
    ...l,
    situations: l.situations.map((s) =>
      s.id !== frameId
        ? s
        : { ...s, positions: { ...s.positions, [base]: { ...s.positions[base], [slot]: p } } },
    ),
  };
}

export function addSituation(l: DefenseLayout, name: string): { layout: DefenseLayout; id: string } | null {
  const n = normalizeSituationName(name);
  if (!n) return null;
  const id = newSituationId();
  return {
    id,
    layout: {
      ...l,
      situations: [
        ...l.situations,
        { id, name: n, positions: { setterFront: structuredClone(l.bases.setterFront), setterBack: structuredClone(l.bases.setterBack) } },
      ],
    },
  };
}

export function renameSituation(l: DefenseLayout, id: string, name: string): DefenseLayout | null {
  const n = normalizeSituationName(name);
  if (!n) return null;
  return { ...l, situations: l.situations.map((s) => (s.id === id ? { ...s, name: n } : s)) };
}

export function removeSituation(l: DefenseLayout, id: string): DefenseLayout {
  return { ...l, situations: l.situations.filter((s) => s.id !== id) };
}

export function moveSituation(l: DefenseLayout, id: string, dir: -1 | 1): DefenseLayout {
  const i = l.situations.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= l.situations.length) return l;
  const list = [...l.situations];
  [list[i], list[j]] = [list[j], list[i]];
  return { ...l, situations: list };
}

export function resetSituationFromBase(l: DefenseLayout, id: string, base: DefenseBaseKey): DefenseLayout {
  return {
    ...l,
    situations: l.situations.map((s) =>
      s.id !== id ? s : { ...s, positions: { ...s.positions, [base]: structuredClone(l.bases[base]) } },
    ),
  };
}

export const otherDefenseBase = (base: DefenseBaseKey): DefenseBaseKey =>
  base === "setterFront" ? "setterBack" : "setterFront";

/**
 * 把某影格（基本站位或情況）的一組站位，依「場上區位」複製到另一組：
 * 舉球員前排時右前是舉球、右後是副攻；後排時相反，所以舉球與副攻對調，其餘四格照搬。
 * 找不到情況 id 時原樣回傳。
 */
export function copyDefenseFrameToOtherBase(
  l: DefenseLayout,
  frameId: string,
  from: DefenseBaseKey,
): DefenseLayout {
  const to = otherDefenseBase(from);
  const mapped = (src: DefenseFrame): DefenseFrame => {
    const f = structuredClone(src);
    return { ...f, S: f.OPP, OPP: f.S };
  };
  if (frameId === BASE_FRAME_ID) {
    return { ...l, bases: { ...l.bases, [to]: mapped(l.bases[from]) } };
  }
  return {
    ...l,
    situations: l.situations.map((s) =>
      s.id !== frameId ? s : { ...s, positions: { ...s.positions, [to]: mapped(s.positions[from]) } },
    ),
  };
}

export function setReceivePoint(
  l: ReceiveLayout,
  rotation: RotationNo,
  frame: ReceiveFrameKey,
  slot: ReceiveSlot,
  p: Point,
): ReceiveLayout {
  return {
    ...l,
    rotations: l.rotations.map((r) =>
      r.rotation !== rotation ? r : { ...r, [frame]: { ...r[frame], [slot]: p } },
    ),
  };
}
