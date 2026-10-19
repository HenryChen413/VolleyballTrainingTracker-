import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Pencil, Plus, RotateCcw, ShieldHalf, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormationCourt, { type CourtToken } from "@/components/formations/FormationCourt";
import FormationLineupBar from "@/components/formations/FormationLineupBar";
import SituationNameDialog from "@/components/formations/SituationNameDialog";
import SlotPlayerPicker from "@/components/formations/SlotPlayerPicker";
import { useFormation } from "@/components/formations/useFormation";
import { useRosterSource } from "@/components/tactics/useRosterSource";
import {
  DEFENSE_BASE_KEYS,
  DEFENSE_BASE_LABEL,
  parseDefenseLayout,
  SITUATION_NAME_MAX,
  type DefenseBaseKey,
} from "@/lib/formations/layout";
import { assignPlayer, autoAssign, clearSlot, type SlotAssignment } from "@/lib/formations/lineup";
import {
  addSituation,
  BASE_FRAME_ID,
  copyDefenseFrameToOtherBase,
  moveSituation,
  otherDefenseBase,
  removeSituation,
  renameSituation,
  resetSituationFromBase,
  setDefensePoint,
} from "@/lib/formations/ops";
import { DEFENSE_SLOT_META, DEFENSE_SLOTS, type DefenseSlot } from "@/lib/formations/slots";
import { confirmAction } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { PERM, useAuthStore } from "@/stores/authStore";
import FormationHeader from "@/components/formations/FormationHeader";

const NAME_ERROR = `名稱需為 1–${SITUATION_NAME_MAX} 字`;

export default function DefenseFormationPage() {
  const canEdit = useAuthStore((s) => s.can)(PERM.FormationsEdit);
  const f = useFormation("defense", parseDefenseLayout);
  const source = useRosterSource({ loadAllPlayers: false });

  const [base, setBase] = useState<DefenseBaseKey>("setterFront");
  const [frameId, setFrameId] = useState<string>(BASE_FRAME_ID);
  const [pickSlot, setPickSlot] = useState<DefenseSlot | null>(null);
  const [nameDialog, setNameDialog] = useState<{ mode: "add" | "rename"; key: number } | null>(null);

  // 陣容：自動預填為派生值；手動改選依名單來源分開保存，換賽事不殘留
  const autoAssignment = useMemo<SlotAssignment<DefenseSlot>>(
    () => (source.roster ? autoAssign(DEFENSE_SLOTS, DEFENSE_SLOT_META, source.roster) : {}),
    [source.roster],
  );
  const [manual, setManual] = useState<{ key: string; value: SlotAssignment<DefenseSlot> } | null>(null);
  const assignment = manual?.key === source.sourceKey ? manual.value : autoAssignment;

  const layout = f.layout;
  if (!layout) {
    return <FormationHeader.Loading title="防守站位" query={f.query} />;
  }

  const situation = layout.situations.find((s) => s.id === frameId);
  // 目前情況被刪除時自動回到基本站位
  const activeId = situation ? situation.id : BASE_FRAME_ID;
  const frame = situation ? situation.positions[base] : layout.bases[base];
  const frameOrder = [BASE_FRAME_ID, ...layout.situations.map((s) => s.id)];
  const idx = frameOrder.indexOf(activeId);

  const tokens: CourtToken[] = DEFENSE_SLOTS.map((slot) => {
    const p = assignment[slot];
    return {
      key: slot,
      role: DEFENSE_SLOT_META[slot].position,
      primary: p ? String(p.jerseyNo ?? "–") : DEFENSE_SLOT_META[slot].label,
      secondary: p?.name,
      point: frame[slot],
    };
  });

  const handleDelete = async () => {
    if (!situation) return;
    const r = await confirmAction("刪除情況？", `確定要刪除「${situation.name}」嗎？儲存後才會生效。`, "刪除", true);
    if (!r.isConfirmed) return;
    f.update((l) => removeSituation(l, situation.id));
    setFrameId(BASE_FRAME_ID);
  };

  // 把目前影格的這一組站位照名稱複製到另一組（兩組站法相同），套用後切到目標組方便微調
  const handleCopyToOtherBase = async () => {
    const target = otherDefenseBase(base);
    const r = await confirmAction(
      `套用到${DEFENSE_BASE_LABEL[target]}？`,
      `把「${situation?.name ?? "基本站位"}」的${DEFENSE_BASE_LABEL[base]}站位套用到${DEFENSE_BASE_LABEL[target]}，目標的站位會被覆蓋。`,
      "套用",
    );
    if (!r.isConfirmed) return;
    f.update((l) => copyDefenseFrameToOtherBase(l, activeId, base));
    setBase(target);
  };

  const handleReset = async () => {
    if (!situation) return;
    const r = await confirmAction(
      "從基本站位重新套用？",
      `「${situation.name}」的${DEFENSE_BASE_LABEL[base]}站位會被基本站位覆蓋。`,
      "套用",
    );
    if (r.isConfirmed) f.update((l) => resetSituationFromBase(l, situation.id, base));
  };

  const handleCancel = async () => {
    if (f.dirty) {
      const r = await confirmAction("放棄修改？", "尚未儲存的站位修改將會遺失。", "放棄", true);
      if (!r.isConfirmed) return;
    }
    f.cancel();
  };

  const frameButton = (id: string, name: string) => (
    <Button
      key={id}
      variant={activeId === id ? "default" : "ghost"}
      aria-pressed={activeId === id}
      className="w-full justify-start"
      onClick={() => setFrameId(id)}
    >
      {name}
    </Button>
  );

  return (
    <div className="space-y-4">
      <FormationHeader
        title="防守站位"
        icon={ShieldHalf}
        formation={f}
        canEdit={canEdit}
        onCancel={handleCancel}
      />

      <FormationLineupBar source={source} />

      <div className="space-y-4 xl:grid xl:grid-cols-[2fr_3fr] xl:items-start xl:gap-6 xl:space-y-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">影格</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {DEFENSE_BASE_KEYS.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  className="flex-1"
                  variant={base === k ? "default" : "ghost"}
                  aria-pressed={base === k}
                  onClick={() => setBase(k)}
                >
                  {DEFENSE_BASE_LABEL[k]}
                </Button>
              ))}
            </div>
            {f.editing && (
              <Button size="sm" variant="outline" className="w-full" onClick={handleCopyToOtherBase}>
                <Copy className="mr-1 h-4 w-4" />套用到{DEFENSE_BASE_LABEL[otherDefenseBase(base)]}
              </Button>
            )}
            <div className="space-y-1">
              {frameButton(BASE_FRAME_ID, "基本站位")}
              {layout.situations.map((s) => frameButton(s.id, s.name))}
            </div>

            {f.editing && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" onClick={() => setNameDialog({ mode: "add", key: Date.now() })}>
                  <Plus className="mr-1 h-4 w-4" />新增情況
                </Button>
                {situation && (
                  <>
                    <Button size="sm" variant="outline" aria-label="改名情況" onClick={() => setNameDialog({ mode: "rename", key: Date.now() })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="上移情況" onClick={() => f.update((l) => moveSituation(l, situation.id, -1))}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="下移情況" onClick={() => f.update((l) => moveSituation(l, situation.id, 1))}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="從基本站位重新套用" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="刪除情況" className="text-destructive" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="mx-auto max-w-md">
              <FormationCourt
                tokens={tokens}
                ghosts={situation ? layout.bases[base] : undefined}
                editable={f.editing}
                onMove={(slot, p) => f.update((l) => setDefensePoint(l, base, activeId, slot as DefenseSlot, p))}
                onTokenClick={source.roster ? (slot) => setPickSlot(slot as DefenseSlot) : undefined}
              />
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" disabled={idx <= 0} onClick={() => setFrameId(frameOrder[idx - 1])}>
                <ChevronLeft className="mr-1 h-4 w-4" />上一步
              </Button>
              <Button variant="outline" disabled={idx >= frameOrder.length - 1} onClick={() => setFrameId(frameOrder[idx + 1])}>
                下一步<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            {f.editing && <p className={cn("text-center text-xs text-muted-foreground")}>拖曳球員調整「{situation?.name ?? "基本站位"}」的{DEFENSE_BASE_LABEL[base]}站位</p>}
          </CardContent>
        </Card>
      </div>

      {pickSlot && source.roster && (
        <SlotPlayerPicker
          open
          slotLabel={DEFENSE_SLOT_META[pickSlot].label}
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

      {nameDialog && (
        <SituationNameDialog
          key={nameDialog.key}
          open
          title={nameDialog.mode === "add" ? "新增情況" : "改名情況"}
          initial={nameDialog.mode === "rename" ? situation?.name ?? "" : ""}
          onSubmit={(name) => {
            if (nameDialog.mode === "add") {
              const res = addSituation(layout, name);
              if (!res) return NAME_ERROR;
              f.update(() => res.layout);
              setFrameId(res.id);
            } else if (situation) {
              const next = renameSituation(layout, situation.id, name);
              if (!next) return NAME_ERROR;
              f.update(() => next);
            }
            setNameDialog(null);
            return null;
          }}
          onClose={() => setNameDialog(null)}
        />
      )}
    </div>
  );
}
