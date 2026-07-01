import { useEffect, useState } from "react";
import { useForm, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sessionsApi, type SessionUpsert } from "@/api/sessions";
import SessionDrillsSelector from "@/components/SessionDrillsSelector";
import { PERM, useAuthStore } from "@/stores/authStore";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { useBusy } from "@/lib/useBusy";
import { DateInput } from "@/components/DateInput";

const schema = z.object({
  sessionDate: z.string().min(1, "必填"),
  location: z.string().max(128).nullable().optional(),
  notes: z.string().max(1024).nullable().optional(),
});

type Inputs = z.input<typeof schema>;
type Outputs = z.output<typeof schema>;

export default function SessionEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.can(PERM.SessionsEdit));
  const canSave = canEdit;
  const canDelete = !isNew && canEdit;

  const { busy, run } = useBusy();
  const [drillIds, setDrillIds] = useState<number[]>([]);

  const { data } = useQuery({
    queryKey: ["sessions", id],
    queryFn: () => sessionsApi.get(Number(id)),
    enabled: !isNew,
  });

  // 最近常用地點：供快速點選（比照哭哭榜「最近常用原因」）
  const { data: recentLocations } = useQuery({
    queryKey: ["sessions", "recent-locations"],
    queryFn: () => sessionsApi.recentLocations(),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Inputs, unknown, Outputs>({
    resolver: zodResolver(schema),
    defaultValues: { sessionDate: new Date().toISOString().slice(0, 10) },
  });

  const { field: sessionDateField } = useController({
    name: "sessionDate",
    control,
  });

  useEffect(() => {
    if (data) {
      reset({
        sessionDate: data.sessionDate.slice(0, 10),
        location: data.location,
        notes: data.notes,
      });
    }
  }, [data, reset]);

  // 於 render 階段同步已選 drillIds（取代 effect 內 setState，避免連鎖渲染）
  const [prevData, setPrevData] = useState<typeof data>(undefined);
  if (data && data !== prevData) {
    setPrevData(data);
    setDrillIds(data.drills.map((d) => d.drillId));
  }

  const onSubmit = async (v: Outputs) => {
    const payload: SessionUpsert = {
      sessionDate: `${v.sessionDate}T00:00:00`,
      startTime: null,
      location: v.location || null,
      notes: v.notes || null,
      drillIds,
    };
    try {
      if (isNew) {
        await sessionsApi.create(payload);
      } else {
        await sessionsApi.update(Number(id), payload);
      }
      await qc.invalidateQueries({ queryKey: ["sessions"] });
      await showSuccess(isNew ? "訓練已新增" : "儲存成功");
      navigate("/sessions");
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      showError(m ?? "儲存失敗");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? "新增訓練" : "訓練"}</CardTitle>
          {!isNew && data?.updatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              最後更新：{data.updatedByName ?? "—"} 於{" "}
              {new Date(data.updatedAt).toLocaleString("zh-TW", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* 送出/刪除進行中時，整個表單欄位與按鈕一律鎖定 */}
            <fieldset
              disabled={isSubmitting || busy}
              className="space-y-6 min-w-0 border-0 p-0 m-0"
            >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>日期 *</Label>
                <DateInput
                  value={sessionDateField.value}
                  onChange={(v) => sessionDateField.onChange(v ?? "")}
                />
                {errors.sessionDate && (
                  <p className="text-sm text-destructive">
                    {errors.sessionDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">地點</Label>
                <Input id="location" {...register("location")} />
                {canSave && (recentLocations?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-xs text-muted-foreground py-0.5">
                      最近常用：
                    </span>
                    {recentLocations!.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() =>
                          setValue("location", loc, { shouldDirty: true })
                        }
                        className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent transition-colors"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>訓練項目</Label>
              <SessionDrillsSelector
                value={drillIds}
                onChange={setDrillIds}
                readOnly={!canSave}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">備註</Label>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </div>

            <div className="flex gap-2">
              {canSave && (
                <Button type="submit" disabled={isSubmitting || busy}>
                  {isSubmitting ? "儲存中…" : "儲存"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || busy}
                onClick={() => navigate("/sessions")}
              >
                返回
              </Button>
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto text-destructive"
                  disabled={isSubmitting || busy}
                  onClick={() => run(async () => {
                    const result = await confirmAction(
                      "確定刪除此訓練？",
                      "相關訓練項目會一併刪除。",
                      "刪除",
                      true,
                    );
                    if (!result.isConfirmed) return;
                    try {
                      await sessionsApi.remove(Number(id));
                      await qc.invalidateQueries({ queryKey: ["sessions"] });
                      await showSuccess("訓練已刪除");
                      navigate("/sessions");
                    } catch (e: unknown) {
                      const m = (
                        e as { response?: { data?: { message?: string } } }
                      )?.response?.data?.message;
                      showError(m ?? "刪除失敗");
                    }
                  })}
                >
                  刪除訓練
                </Button>
              )}
            </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
