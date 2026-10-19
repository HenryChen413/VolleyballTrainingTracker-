// 內建預設站位：DB 尚無資料時顯示，教練從這裡開始調整。
// 防守：以「場上六個區位」定義座標再對應到格子；球隊打法為舉球員前排／後排站法相同。
// 接發：依輪轉自動產生合法站位（測試保證全部通過位置錯誤檢查）。
import type { Point } from "./geometry";
import type { DefenseBaseKey, DefenseFrame, DefenseLayout, ReceiveFrame, ReceiveLayout, ReceiveSystem } from "./layout";
import {
  COURT_POSITIONS,
  isFrontRow,
  rotationLineup,
  ROTATIONS,
  type CourtPos,
  type ReceiveSlot,
  type RotationNo,
} from "./rotation";
import { RECEIVE_SLOT_META, type DefenseSlot } from "./slots";

// ---------- 防守 ----------

/** 區位：前排左／中／右、後排左／中／右 */
type Spot = "LF" | "MF" | "RF" | "LB" | "MBk" | "RB";

const SPOT_TO_SLOT: Readonly<Record<Spot, DefenseSlot>> = { LF: "OHF", MF: "MB", RF: "S", LB: "L", MBk: "OHB", RB: "OPP" };
const SPOT_SLOT: Readonly<Record<DefenseBaseKey, Record<Spot, DefenseSlot>>> = {
  setterFront: SPOT_TO_SLOT,
  setterBack: SPOT_TO_SLOT,
};

const BASE_SPOTS: Record<Spot, Point> = {
  LF: { x: 0.17, y: 0.09 },
  MF: { x: 0.5, y: 0.09 },
  RF: { x: 0.83, y: 0.09 },
  LB: { x: 0.12, y: 0.55 },
  MBk: { x: 0.5, y: 0.68 },
  RB: { x: 0.88, y: 0.55 },
};

const SITUATION_SPOTS: ReadonlyArray<{ name: string; spots: Record<Spot, Point> }> = [
  {
    name: "對方打4號位",
    spots: {
      LF: { x: 0.12, y: 0.3 }, MF: { x: 0.66, y: 0.04 }, RF: { x: 0.78, y: 0.04 },
      LB: { x: 0.15, y: 0.55 }, MBk: { x: 0.6, y: 0.78 }, RB: { x: 0.88, y: 0.6 },
    },
  },
  {
    name: "對方打2號位",
    spots: {
      LF: { x: 0.22, y: 0.04 }, MF: { x: 0.34, y: 0.04 }, RF: { x: 0.88, y: 0.3 },
      LB: { x: 0.12, y: 0.6 }, MBk: { x: 0.4, y: 0.78 }, RB: { x: 0.85, y: 0.55 },
    },
  },
  {
    name: "對方中間快攻",
    spots: {
      LF: { x: 0.15, y: 0.15 }, MF: { x: 0.5, y: 0.04 }, RF: { x: 0.85, y: 0.15 },
      LB: { x: 0.2, y: 0.5 }, MBk: { x: 0.5, y: 0.7 }, RB: { x: 0.8, y: 0.5 },
    },
  },
  {
    name: "對方吊球",
    spots: {
      LF: { x: 0.17, y: 0.06 }, MF: { x: 0.5, y: 0.04 }, RF: { x: 0.83, y: 0.06 },
      LB: { x: 0.2, y: 0.35 }, MBk: { x: 0.5, y: 0.6 }, RB: { x: 0.8, y: 0.35 },
    },
  },
  {
    name: "機會球",
    spots: {
      LF: { x: 0.1, y: 0.3 }, MF: { x: 0.5, y: 0.32 }, RF: { x: 0.9, y: 0.3 },
      LB: { x: 0.15, y: 0.6 }, MBk: { x: 0.5, y: 0.62 }, RB: { x: 0.85, y: 0.6 },
    },
  },
];

function frameFromSpots(base: DefenseBaseKey, spots: Record<Spot, Point>): DefenseFrame {
  const f = {} as DefenseFrame;
  for (const s of Object.keys(spots) as Spot[]) f[SPOT_SLOT[base][s]] = { ...spots[s] };
  return f;
}

export function defaultDefenseLayout(): DefenseLayout {
  return {
    version: 1,
    bases: {
      setterFront: frameFromSpots("setterFront", BASE_SPOTS),
      setterBack: frameFromSpots("setterBack", BASE_SPOTS),
    },
    situations: SITUATION_SPOTS.map((s, i) => ({
      id: `d${i + 1}`,
      name: s.name,
      positions: {
        setterFront: frameFromSpots("setterFront", s.spots),
        setterBack: frameFromSpots("setterBack", s.spots),
      },
    })),
  };
}

// ---------- 接發 ----------

/** 該體系在此輪轉的接發者 */
export function receiversFor(system: ReceiveSystem, rotation: RotationNo): ReadonlySet<ReceiveSlot> {
  if (system === "receive-2oh") return new Set<ReceiveSlot>(["OH1", "OH2", "L"]);
  const lineup = rotationLineup(rotation);
  const backOh = COURT_POSITIONS.map((p) => ({ p, s: lineup[p] })).find(
    ({ p, s }) => !isFrontRow(p) && (s === "OH1" || s === "OH2"),
  );
  const set = new Set<ReceiveSlot>(["OPP", "L"]);
  if (backOh) set.add(backOh.s);
  return set;
}

const COLUMN_X: Readonly<Record<CourtPos, number>> = { 4: 0.17, 5: 0.17, 3: 0.5, 6: 0.5, 2: 0.83, 1: 0.83 };
/** 後排號位 → 同一直行的前排號位 */
const FRONT_OF: Readonly<Partial<Record<CourtPos, CourtPos>>> = { 5: 4, 6: 3, 1: 2 };

function defaultReceiveFrame(system: ReceiveSystem, rotation: RotationNo): ReceiveFrame {
  const lineup = rotationLineup(rotation);
  const recv = receiversFor(system, rotation);
  const frontY = (pos: CourtPos) => (recv.has(lineup[pos]) ? 0.48 : 0.08);
  const frame: ReceiveFrame = {};
  for (const pos of COURT_POSITIONS) {
    const slot = lineup[pos];
    let y: number;
    if (isFrontRow(pos)) {
      y = frontY(pos);
    } else {
      const fy = frontY(FRONT_OF[pos] as CourtPos);
      // 接發者站一排；非接發者（如後排舉球員）躲在同一直行前排隊友正後方
      y = recv.has(slot) ? Math.max(0.58, fy + 0.06) : fy + 0.06;
    }
    frame[slot] = { x: COLUMN_X[pos], y };
  }
  return frame;
}

const FRONT_ATTACK: Readonly<Record<string, Point>> = {
  OH: { x: 0.08, y: 0.28 },
  MB: { x: 0.5, y: 0.22 },
  OPP: { x: 0.92, y: 0.28 },
};
const BACK_ATTACK: Readonly<Record<string, Point>> = {
  OH: { x: 0.5, y: 0.62 },
  MB: { x: 0.5, y: 0.62 },
  OPP: { x: 0.82, y: 0.62 },
};

function defaultAttackFrame(rotation: RotationNo): ReceiveFrame {
  const lineup = rotationLineup(rotation);
  const frame: ReceiveFrame = {};
  for (const pos of COURT_POSITIONS) {
    const slot = lineup[pos];
    const role = RECEIVE_SLOT_META[slot].position;
    frame[slot] =
      slot === "S"
        ? { x: 0.66, y: 0.05 }
        : slot === "L"
          ? { x: 0.2, y: 0.62 }
          : { ...(isFrontRow(pos) ? FRONT_ATTACK[role] : BACK_ATTACK[role]) };
  }
  return frame;
}

export function defaultReceiveLayout(system: ReceiveSystem): ReceiveLayout {
  return {
    version: 1,
    rotations: ROTATIONS.map((r) => ({
      rotation: r,
      receive: defaultReceiveFrame(system, r),
      attack: defaultAttackFrame(r),
    })),
  };
}
