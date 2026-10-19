import type { PositionCode } from "@/lib/positions";
import type { ReceiveSlot } from "./rotation";

/** 防守格子：防守不分輪轉，主攻只分前排（OHF）／後排（OHB） */
export type DefenseSlot = "S" | "OPP" | "OHF" | "OHB" | "MB" | "L";

/** 陣容自動預填依此順序：同位置多人時，前面的格子先拿到背號小的球員 */
export const DEFENSE_SLOTS: readonly DefenseSlot[] = ["S", "OPP", "OHF", "OHB", "MB", "L"];
export const RECEIVE_SLOTS: readonly ReceiveSlot[] = ["S", "OPP", "OH1", "OH2", "MB1", "MB2", "L"];

export interface SlotMeta {
  /** 未帶入陣容時 token 上顯示的代號 */
  label: string;
  /** 對應的球員位置代碼（配色、自動預填用） */
  position: PositionCode;
}

export const DEFENSE_SLOT_META: Readonly<Record<DefenseSlot, SlotMeta>> = {
  S: { label: "舉球", position: "S" },
  OPP: { label: "副攻", position: "OPP" },
  OHF: { label: "主攻(前)", position: "OH" },
  OHB: { label: "主攻(後)", position: "OH" },
  MB: { label: "攔中", position: "MB" },
  L: { label: "自由", position: "L" },
};

export const RECEIVE_SLOT_META: Readonly<Record<ReceiveSlot, SlotMeta>> = {
  S: { label: "舉球", position: "S" },
  OPP: { label: "副攻", position: "OPP" },
  OH1: { label: "主攻1", position: "OH" },
  OH2: { label: "主攻2", position: "OH" },
  MB1: { label: "攔中1", position: "MB" },
  MB2: { label: "攔中2", position: "MB" },
  L: { label: "自由", position: "L" },
};
