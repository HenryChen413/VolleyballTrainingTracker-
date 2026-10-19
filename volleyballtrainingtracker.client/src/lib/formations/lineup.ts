// 陣容帶入：把賽事報名球員填進位置格子（只影響顯示，不寫入 DB）。
import type { RosterPlayer } from "@/lib/court";
import { primaryPosition } from "@/lib/positions";
import type { SlotMeta } from "./slots";

export type SlotAssignment<S extends string> = Partial<Record<S, RosterPlayer>>;

const byJersey = (a: RosterPlayer, b: RosterPlayer) =>
  (a.jerseyNo ?? Number.POSITIVE_INFINITY) - (b.jerseyNo ?? Number.POSITIVE_INFINITY) ||
  a.name.localeCompare(b.name, "zh-Hant");

/** 依球員主要位置自動預填；同位置多人時依背號（null 最後）、再依姓名 */
export function autoAssign<S extends string>(
  slots: readonly S[],
  meta: Readonly<Record<S, SlotMeta>>,
  roster: readonly RosterPlayer[],
): SlotAssignment<S> {
  const pools = new Map<string, RosterPlayer[]>();
  for (const p of [...roster].sort(byJersey)) {
    const pos = primaryPosition(p.position);
    if (!pos) continue;
    const list = pools.get(pos) ?? [];
    list.push(p);
    pools.set(pos, list);
  }
  const out: SlotAssignment<S> = {};
  for (const s of slots) {
    const next = pools.get(meta[s].position)?.shift();
    if (next) out[s] = next;
  }
  return out;
}

/** 指定某格球員；該球員已在別格時兩格互換（原格為空則別格清空） */
export function assignPlayer<S extends string>(
  current: SlotAssignment<S>,
  slot: S,
  player: RosterPlayer,
): SlotAssignment<S> {
  const next: SlotAssignment<S> = { ...current };
  const from = (Object.keys(next) as S[]).find(
    (k) => k !== slot && next[k]?.playerId === player.playerId,
  );
  if (from) {
    const displaced = next[slot];
    if (displaced) next[from] = displaced;
    else delete next[from];
  }
  next[slot] = player;
  return next;
}

export function clearSlot<S extends string>(current: SlotAssignment<S>, slot: S): SlotAssignment<S> {
  const next: SlotAssignment<S> = { ...current };
  delete next[slot];
  return next;
}
