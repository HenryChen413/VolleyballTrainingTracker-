// 接發輪轉（5-1 體系）：R1 排法為球隊實際排法，見設計文件。
// 每得發球權順時針輪轉一格：Rn 的 p 號位 = R1 的 ((p−1+n−1) mod 6)+1 號位。

export type CourtPos = 1 | 2 | 3 | 4 | 5 | 6;
export type RotationNo = 1 | 2 | 3 | 4 | 5 | 6;
export type ReceiveSlot = "S" | "OPP" | "OH1" | "OH2" | "MB1" | "MB2" | "L";
type RawSlot = Exclude<ReceiveSlot, "L">;

export const ROTATIONS: readonly RotationNo[] = [1, 2, 3, 4, 5, 6];
export const COURT_POSITIONS: readonly CourtPos[] = [1, 2, 3, 4, 5, 6];

/** R1 的 1–6 號位 */
export const R1_ORDER: Readonly<Record<CourtPos, RawSlot>> = {
  1: "OH2",
  2: "MB1",
  3: "S",
  4: "OH1",
  5: "MB2",
  6: "OPP",
};

const FRONT_ROW: ReadonlySet<CourtPos> = new Set<CourtPos>([2, 3, 4]);
export const isFrontRow = (pos: CourtPos) => FRONT_ROW.has(pos);

function rawSlotAt(rotation: RotationNo, pos: CourtPos): RawSlot {
  const r1Pos = (((pos - 1 + (rotation - 1)) % 6) + 1) as CourtPos;
  return R1_ORDER[r1Pos];
}

/** 該輪轉場上 1–6 號位的格子；後排攔中由自由（L）替換 */
export function rotationLineup(rotation: RotationNo): Record<CourtPos, ReceiveSlot> {
  const out = {} as Record<CourtPos, ReceiveSlot>;
  for (const pos of COURT_POSITIONS) {
    const raw = rawSlotAt(rotation, pos);
    out[pos] = !isFrontRow(pos) && (raw === "MB1" || raw === "MB2") ? "L" : raw;
  }
  return out;
}

export function setterPosition(rotation: RotationNo): CourtPos {
  return COURT_POSITIONS.find((p) => rawSlotAt(rotation, p) === "S") as CourtPos;
}

export const isSetterFrontRow = (rotation: RotationNo) => isFrontRow(setterPosition(rotation));

/** 自由球員替換的攔中（在後排的那一位） */
export function liberoReplaces(rotation: RotationNo): "MB1" | "MB2" {
  const pos = COURT_POSITIONS.find((p) => {
    const raw = rawSlotAt(rotation, p);
    return !isFrontRow(p) && (raw === "MB1" || raw === "MB2");
  }) as CourtPos;
  return rawSlotAt(rotation, pos) as "MB1" | "MB2";
}

/** 該輪轉在場上的 6 格（依 1–6 號位順序） */
export function onCourtSlots(rotation: RotationNo): ReceiveSlot[] {
  const lineup = rotationLineup(rotation);
  return COURT_POSITIONS.map((p) => lineup[p]);
}

export const rotationLabel = (rotation: RotationNo) =>
  `R${rotation}（舉球在${setterPosition(rotation)}號位）`;
