import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormationCourt, { type CourtToken } from "@/components/formations/FormationCourt";
import FormationHeader from "@/components/formations/FormationHeader";
import FormationLineupBar from "@/components/formations/FormationLineupBar";
import SlotPlayerPicker from "@/components/formations/SlotPlayerPicker";
import { useFormation } from "@/components/formations/useFormation";
import { useRosterSource } from "@/components/tactics/useRosterSource";
import {
  parseReceiveLayout,
  RECEIVE_SYSTEMS,
  type ReceiveFrameKey,
  type ReceiveLayout,
  type ReceiveSystem,
} from "@/lib/formations/layout";
import { assignPlayer, autoAssign, clearSlot, type SlotAssignment } from "@/lib/formations/lineup";
import { setReceivePoint } from "@/lib/formations/ops";
import { checkOverlap } from "@/lib/formations/overlap";
import {
  isSetterFrontRow,
  liberoReplaces,
  onCourtSlots,
  rotationLabel,
  ROTATIONS,
  type ReceiveSlot,
  type RotationNo,
} from "@/lib/formations/rotation";
import { RECEIVE_SLOT_META, RECEIVE_SLOTS } from "@/lib/formations/slots";
import { confirmAction } from "@/lib/swal";
import { PERM, useAuthStore } from "@/stores/authStore";

const parse2oh = (raw: unknown) => parseReceiveLayout(raw, "receive-2oh");
const parseOh1Opp = (raw: unknown) => parseReceiveLayout(raw, "receive-oh1-opp");
const parseOh2Opp = (raw: unknown) => parseReceiveLayout(raw, "receive-oh2-opp");

const FRAME_LABEL: Record<ReceiveFrameKey, string> = { receive: "接發站位", attack: "進攻位置" };
const FRAME_KEYS: readonly ReceiveFrameKey[] = ["receive", "attack"];
/** 上一步／下一步的順序：R1 接發 → R1 進攻 → R2 接發 … */
const STEPS = ROTATIONS.flatMap((r) => FRAME_KEYS.map((k) => ({ rotation: r, frame: k })));

export default function ReceiveFormationPage() {
  const canEdit = useAuthStore((s) => s.can)(PERM.FormationsEdit);
  // 三套各自載入（hook 數量固定），依目前選的體系取用
  const formations: Record<ReceiveSystem, ReturnType<typeof useFormation<ReceiveLayout>>> = {
    "receive-2oh": useFormation("receive-2oh", parse2oh),
    "receive-oh1-opp": useFormation("receive-oh1-opp", parseOh1Opp),
    "receive-oh2-opp": useFormation("receive-oh2-opp", parseOh2Opp),
  };
  const source = useRosterSource({ loadAllPlayers: false });

  const [system, setSystem] = useState<ReceiveSystem>("receive-2oh");
  const [rotation, setRotation] = useState<RotationNo>(1);
  const [frameKey, setFrameKey] = useState<ReceiveFrameKey>("receive");
  const [pickSlot, setPickSlot] = useState<ReceiveSlot | null>(null);

  const autoAssignment = useMemo<SlotAssignment<ReceiveSlot>>(
    () => (source.roster ? autoAssign(RECEIVE_SLOTS, RECEIVE_SLOT_META, source.roster) : {}),
    [source.roster],
  );
  const [manual, setManual] = useState<{ key: string; value: SlotAssignment<ReceiveSlot> } | null>(null);
  const assignment = manual?.key === source.sourceKey ? manual.value : autoAssignment;

  const f = formations[system];
  const layout = f.layout;
  if (!layout) {
    return <FormationHeader.Loading title="接發站位" query={f.query} />;
  }

  const rot = layout.rotations[rotation - 1];
  const points = rot[frameKey];
  const fallback = { x: 0.5, y: 0.5 };
  const violations = frameKey === "receive" ? checkOverlap(rotation, points) : [];
  const stepIdx = STEPS.findIndex((s) => s.rotation === rotation && s.frame === frameKey);
  const goStep = (i: number) => {
    setRotation(STEPS[i].rotation);
    setFrameKey(STEPS[i].frame);
  };

  const tokens: CourtToken[] = onCourtSlots(rotation).map((slot) => {
    const p = assignment[slot];
    return {
      key: slot,
      role: RECEIVE_SLOT_META[slot].position,
      primary: p ? String(p.jerseyNo ?? "–") : RECEIVE_SLOT_META[slot].label,
      secondary: p?.name,
      point: points[slot] ?? fallback,
    };
  });

  const handleCancel = async () => {
    if (f.dirty) {
      const r = await confirmAction("放棄修改？", "尚未儲存的站位修改將會遺失。", "放棄", true);
      if (!r.isConfirmed) return;
    }
    f.cancel();
  };

  return (
    <div className="space-y-4">
      <FormationHeader title="接發站位" icon={Hand} formation={f} canEdit={canEdit} onCancel={handleCancel} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
          {RECEIVE_SYSTEMS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={system === s.key ? "default" : "ghost"}
              aria-pressed={system === s.key}
              // 編輯中不可切換體系，避免草稿與畫面對不上
              disabled={f.editing && system !== s.key}
              onClick={() => setSystem(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <FormationLineupBar source={source} />

      <div className="space-y-4 xl:grid xl:grid-cols-[2fr_3fr] xl:items-start xl:gap-6 xl:space-y-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">輪轉與影格</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-6 gap-1">
              {ROTATIONS.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={rotation === r ? "default" : "outline"}
                  aria-pressed={rotation === r}
                  title={rotationLabel(r)}
                  onClick={() => setRotation(r)}
                >
                  R{r}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {FRAME_KEYS.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  className="flex-1"
                  variant={frameKey === k ? "default" : "ghost"}
                  aria-pressed={frameKey === k}
                  onClick={() => setFrameKey(k)}
                >
                  {FRAME_LABEL[k]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              舉球員{isSetterFrontRow(rotation) ? "前排" : "後排"}；自由替換{RECEIVE_SLOT_META[liberoReplaces(rotation)].label}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-center text-sm font-semibold">
              <span>{rotationLabel(rotation)}</span> · {FRAME_LABEL[frameKey]}
            </p>
            <div className="mx-auto max-w-md">
              <FormationCourt
                tokens={tokens}
                ghosts={frameKey === "attack" ? rot.receive : undefined}
                violations={violations.map((v) => ({ a: points[v.a] ?? fallback, b: points[v.b] ?? fallback }))}
                editable={f.editing}
                onMove={(slot, p) => f.update((l) => setReceivePoint(l, rotation, frameKey, slot as ReceiveSlot, p))}
                onTokenClick={source.roster ? (slot) => setPickSlot(slot as ReceiveSlot) : undefined}
              />
            </div>
            {violations.length > 0 && (
              <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {violations.map((v) => (
                  <li key={`${v.a}-${v.b}`}>{v.message}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" disabled={stepIdx <= 0} onClick={() => goStep(stepIdx - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />上一步
              </Button>
              <Button variant="outline" disabled={stepIdx >= STEPS.length - 1} onClick={() => goStep(stepIdx + 1)}>
                下一步<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {pickSlot && source.roster && (
        <SlotPlayerPicker
          open
          slotLabel={RECEIVE_SLOT_META[pickSlot].label}
          roster={source.roster}
          currentId={assignment[pickSlot]?.playerId ?? null}
          onPick={(player) => {
            setManual({
              key: source.sourceKey,
              value: player ? assignPlayer(assignment, pickSlot, player) : clearSlot(assignment, pickSlot),
            });
            setPickSlot(null);
          }}
          onClose={() => setPickSlot(null)}
        />
      )}
    </div>
  );
}
