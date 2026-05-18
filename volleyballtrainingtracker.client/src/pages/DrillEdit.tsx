import { useEffect } from "react";
import { useForm, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { drillsApi, type DrillUpsert } from "@/api/drills";
import { CATEGORIES } from "@/lib/drillCategories";
import { PERM, useAuthStore } from "@/stores/authStore";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { useBusy } from "@/lib/useBusy";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "必填").max(64, "名稱最多 64 字"),
  category: z.string().min(1, "必填"),
  description: z
    .string()
    .max(512, "描述最多 512 字")
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});

type Inputs = z.input<typeof schema>;
type Outputs = z.output<typeof schema>;

function getApiErrorMessage(e: unknown, fallback: string) {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}

export default function DrillEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.can(PERM.DrillsEdit));
  const canSave = canEdit;
  const canDelete = !isNew && canEdit;

  const { busy, run } = useBusy();

  // 由「複製為新項目」帶入的預設值
  const preset = (location.state as { preset?: Partial<DrillUpsert> } | null)
    ?.preset;

  const { data } = useQuery({
    queryKey: ["drills", id],
    queryFn: () => drillsApi.get(Number(id)),
    enabled: !isNew,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Inputs, unknown, Outputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: preset?.name ?? "",
      category: preset?.category ?? CATEGORIES[0].value,
      description: preset?.description ?? "",
      isActive: preset?.isActive ?? true,
    },
  });

  const { field: categoryField } = useController({ name: "category", control });
  const { field: activeField } = useController({ name: "isActive", control });

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        category: data.category,
        description: data.description ?? "",
        isActive: data.isActive,
      });
    }
  }, [data, reset]);

  const onSubmit = async (v: Outputs) => {
    const payload: DrillUpsert = {
      name: v.name.trim(),
      category: v.category,
      description: v.description?.trim() ? v.description.trim() : null,
      isActive: v.isActive,
    };
    try {
      if (isNew) await drillsApi.create(payload);
      else await drillsApi.update(Number(id), payload);
      await qc.invalidateQueries({ queryKey: ["drills"] });
      await showSuccess("儲存成功");
      navigate("/drills");
    } catch (e: unknown) {
      showError(getApiErrorMessage(e, "儲存失敗"));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isNew ? "新增訓練項目" : "編輯訓練項目"}</CardTitle>
        {!isNew && data?.updatedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            最後更新：{data.updatedByName ?? "—"} 於{" "}
            {new Date(data.updatedAt).toLocaleString("zh-TW", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">名稱 *</Label>
            <Input id="name" maxLength={64} {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>分類 *</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = categoryField.value === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => categoryField.onChange(c.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors select-none",
                      active
                        ? cn("border-transparent", c.activeClass)
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                    <span
                      className={cn(
                        "text-xs",
                        active ? "opacity-80" : "text-muted-foreground",
                      )}
                    >
                      ({c.value})
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.category && (
              <p className="text-sm text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              rows={4}
              maxLength={512}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={activeField.value ?? true}
              onCheckedChange={activeField.onChange}
              aria-label="啟用狀態"
            />
            <Label htmlFor="isActive">啟用中（取消代表停用）</Label>
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
              onClick={() => navigate("/drills")}
            >
              {canSave ? "取消" : "返回"}
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="outline"
                className="ml-auto text-destructive"
                disabled={isSubmitting || busy}
                onClick={() =>
                  run(async () => {
                    const result = await confirmAction(
                      `確定要停用「${data?.name ?? "此項目"}」？`,
                      "停用後不會出現在新訓練紀錄的選單中，歷史紀錄仍會保留。",
                      "停用",
                      true,
                    );
                    if (!result.isConfirmed) return;
                    try {
                      await drillsApi.remove(Number(id));
                      await qc.invalidateQueries({ queryKey: ["drills"] });
                      await showSuccess("項目已停用");
                      navigate("/drills");
                    } catch (e: unknown) {
                      showError(getApiErrorMessage(e, "停用失敗"));
                    }
                  })
                }
              >
                <span className="flex items-center gap-1">
                  <Trash2 className="h-4 w-4" /> 停用此項目
                </span>
              </Button>
            )}
          </div>

          {!canSave && (
            <p className="text-xs text-muted-foreground">
              你沒有{isNew ? "新增" : "修改"}項目的權限
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
