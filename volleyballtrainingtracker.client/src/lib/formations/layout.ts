// 站位 Layout（存於 DB 的 jsonb 文件）型別與容錯解析器。
// 解析器永不丟例外：缺格／非數字以預設補、越界夾回；整體格式錯誤才整套退回預設（recovered=true）。
import { clampPoint, type Point } from "./geometry";
import { onCourtSlots, ROTATIONS, type ReceiveSlot, type RotationNo } from "./rotation";
import { DEFENSE_SLOTS, type DefenseSlot } from "./slots";
import { defaultDefenseLayout, defaultReceiveLayout } from "./defaults";

export type DefenseBaseKey = "setterFront" | "setterBack";
export const DEFENSE_BASE_KEYS: readonly DefenseBaseKey[] = ["setterFront", "setterBack"];
export const DEFENSE_BASE_LABEL: Readonly<Record<DefenseBaseKey, string>> = {
  setterFront: "舉球員前排",
  setterBack: "舉球員後排",
};

export type DefenseFrame = Record<DefenseSlot, Point>;

export interface DefenseSituation {
  id: string;
  name: string;
  positions: Record<DefenseBaseKey, DefenseFrame>;
}

export interface DefenseLayout {
  version: 1;
  bases: Record<DefenseBaseKey, DefenseFrame>;
  situations: DefenseSituation[];
}

export type ReceiveFrame = Partial<Record<ReceiveSlot, Point>>;
export type ReceiveFrameKey = "receive" | "attack";

export interface ReceiveRotation {
  rotation: RotationNo;
  receive: ReceiveFrame;
  attack: ReceiveFrame;
}

export interface ReceiveLayout {
  version: 1;
  rotations: ReceiveRotation[];
}

/** 接發體系：三名接發者固定（R1–R6 皆同），各自存一套站位 */
export type ReceiveSystem = "receive-2oh" | "receive-oh1-opp" | "receive-oh2-opp";
export const RECEIVE_SYSTEMS: ReadonlyArray<{ key: ReceiveSystem; label: string }> = [
  { key: "receive-2oh", label: "主攻1＋自由＋主攻2" },
  { key: "receive-oh1-opp", label: "主攻1＋自由＋副攻" },
  { key: "receive-oh2-opp", label: "主攻2＋自由＋副攻" },
];

export const SITUATION_NAME_MAX = 20;

export const newSituationId = () => Math.random().toString(36).slice(2, 10);

export interface ParseResult<T> {
  layout: T;
  /** true＝整體格式異常，已整套退回預設（頁面需提示） */
  recovered: boolean;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function parsePoint(v: unknown): Point | null {
  if (!isObj(v)) return null;
  const { x, y } = v;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return clampPoint({ x, y });
}

function parseFrame<S extends string>(
  raw: unknown,
  slots: readonly S[],
  fallback: Partial<Record<S, Point>>,
): Partial<Record<S, Point>> {
  const src: Obj = isObj(raw) ? raw : {};
  const out: Partial<Record<S, Point>> = {};
  for (const s of slots) {
    const p = parsePoint(src[s]);
    const fb = fallback[s];
    if (p) out[s] = p;
    else if (fb) out[s] = { ...fb };
  }
  return out;
}

export function parseDefenseLayout(raw: unknown): ParseResult<DefenseLayout> {
  const def = defaultDefenseLayout();
  if (!isObj(raw) || raw.version !== 1 || !isObj(raw.bases)) return { layout: def, recovered: true };
  const rawBases = raw.bases;

  const bases = {} as Record<DefenseBaseKey, DefenseFrame>;
  for (const k of DEFENSE_BASE_KEYS) {
    bases[k] = parseFrame(rawBases[k], DEFENSE_SLOTS, def.bases[k]) as DefenseFrame;
  }

  const situations: DefenseSituation[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(raw.situations) ? raw.situations : []) {
    if (!isObj(s) || typeof s.name !== "string") continue;
    const name = s.name.trim();
    if (!name || name.length > SITUATION_NAME_MAX) continue;
    let id = typeof s.id === "string" && s.id ? s.id : newSituationId();
    if (seen.has(id)) id = newSituationId();
    seen.add(id);
    const pos: Obj = isObj(s.positions) ? s.positions : {};
    // 情況缺格時以「同組基本站位」補上
    situations.push({
      id,
      name,
      positions: {
        setterFront: parseFrame(pos.setterFront, DEFENSE_SLOTS, bases.setterFront) as DefenseFrame,
        setterBack: parseFrame(pos.setterBack, DEFENSE_SLOTS, bases.setterBack) as DefenseFrame,
      },
    });
  }

  return { layout: { version: 1, bases, situations }, recovered: false };
}

export function parseReceiveLayout(raw: unknown, system: ReceiveSystem): ParseResult<ReceiveLayout> {
  const def = defaultReceiveLayout(system);
  if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.rotations)) {
    return { layout: def, recovered: true };
  }
  const byNo = new Map<number, Obj>();
  for (const r of raw.rotations) {
    if (isObj(r) && typeof r.rotation === "number") byNo.set(r.rotation, r);
  }
  const rotations = ROTATIONS.map((no, i): ReceiveRotation => {
    const src = byNo.get(no) ?? {};
    const slots = onCourtSlots(no);
    const d = def.rotations[i];
    return {
      rotation: no,
      receive: parseFrame(src.receive, slots, d.receive),
      attack: parseFrame(src.attack, slots, d.attack),
    };
  });
  return { layout: { version: 1, rotations }, recovered: false };
}
