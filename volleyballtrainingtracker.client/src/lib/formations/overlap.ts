// 接發位置錯誤（overlap）檢查：發球擊球瞬間，
//   前排左右 4 < 3 < 2、後排左右 5 < 6 < 1（x 遞增）；
//   前後 4 比 5、3 比 6、2 比 1 更靠近球網（y 較小）。相等視為違規。
// 自由球員以其替換之攔中的號位判斷（rotationLineup 已把該號位標為 L）。
import type { Point } from "./geometry";
import { rotationLineup, type CourtPos, type ReceiveSlot, type RotationNo } from "./rotation";
import { RECEIVE_SLOT_META } from "./slots";

export interface OverlapViolation {
  a: ReceiveSlot;
  b: ReceiveSlot;
  message: string;
}

const LEFT_RIGHT: ReadonlyArray<[CourtPos, CourtPos]> = [[4, 3], [3, 2], [5, 6], [6, 1]];
const FRONT_BACK: ReadonlyArray<[CourtPos, CourtPos]> = [[4, 5], [3, 6], [2, 1]];

export function checkOverlap(
  rotation: RotationNo,
  frame: Partial<Record<ReceiveSlot, Point>>,
): OverlapViolation[] {
  const lineup = rotationLineup(rotation);
  const desc = (pos: CourtPos) => `${pos}號位（${RECEIVE_SLOT_META[lineup[pos]].label}）`;
  const out: OverlapViolation[] = [];

  for (const [pa, pb] of LEFT_RIGHT) {
    const a = frame[lineup[pa]];
    const b = frame[lineup[pb]];
    if (a && b && !(a.x < b.x)) {
      out.push({ a: lineup[pa], b: lineup[pb], message: `${desc(pa)}須在${desc(pb)}左側` });
    }
  }
  for (const [pa, pb] of FRONT_BACK) {
    const a = frame[lineup[pa]];
    const b = frame[lineup[pb]];
    if (a && b && !(a.y < b.y)) {
      out.push({ a: lineup[pa], b: lineup[pb], message: `${desc(pa)}須比${desc(pb)}靠近球網` });
    }
  }
  return out;
}
