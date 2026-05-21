import { useEffect } from "react";
import { useForm, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  playersApi,
  PLAYER_STATUS,
  MEMBER_TYPE,
  MEMBER_TYPE_LABEL,
  type PlayerStatus,
  type MemberType,
  type PlayerUpsert,
} from "@/api/players";
import { PERM, useAuthStore } from "@/stores/authStore";
import { confirmAction, showError, showSuccess } from "@/lib/swal";
import { useBusy } from "@/lib/useBusy";
import { DateInput } from "@/components/DateInput";

const POSITIONS = [
  { value: "OH", label: "主攻", sub: "OH" },
  { value: "OPP", label: "副攻", sub: "OPP" },
  { value: "MB", label: "攔中", sub: "MB" },
  { value: "S", label: "舉球員", sub: "S" },
  { value: "L", label: "自由", sub: "L" },
];

const HANDS = [
  { value: "Right", label: "右手" },
  { value: "Left", label: "左手" },
];

const STATUS_OPTIONS = [
  { value: String(PLAYER_STATUS.Active), label: "現役" },
  { value: String(PLAYER_STATUS.Graduated), label: "畢業" },
  { value: String(PLAYER_STATUS.Left), label: "離隊" },
];

const MEMBER_TYPE_OPTIONS = [
  { value: String(MEMBER_TYPE.Player), label: "選手" },
  { value: String(MEMBER_TYPE.Coach), label: "教練" },
  { value: String(MEMBER_TYPE.Manager), label: "球經" },
];

const schema = z.object({
  name: z.string().min(1, "必填").max(64),
  studentId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v),
    z.string().max(32, "學號最多 32 字").nullable(),
  ).optional(),
  nickname: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().max(32, "暱稱最多 32 字").nullable(),
  ).optional(),
  jerseyNo: z.coerce.number().int().min(1).max(99).nullable().optional(),
  positions: z.array(z.string()).default([]),
  heightCm: z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.coerce.number().int().min(100).max(250).nullable()
  ).optional(),
  dominantHand: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  grade: z.coerce.number().int().min(1).nullable().optional(),
  isActive: z.coerce
    .number()
    .int()
    .refine((v): v is PlayerStatus => v === 0 || v === 1 || v === 2, {
      message: "狀態必須為現役/畢業/離隊",
    }),
  memberType: z.coerce
    .number()
    .int()
    .refine((v): v is MemberType => v === 0 || v === 1 || v === 2, {
      message: "身份必須為選手/教練/球經",
    }),
  notes: z.string().max(512).nullable().optional(),
});

type Inputs = z.input<typeof schema>;
type Outputs = z.output<typeof schema>;

function parseMemberTypeParam(raw: string | null): MemberType {
  if (raw === "coach") return MEMBER_TYPE.Coach;
  if (raw === "manager") return MEMBER_TYPE.Manager;
  return MEMBER_TYPE.Player;
}

function memberTypeToUrl(t: MemberType): string {
  if (t === MEMBER_TYPE.Coach) return "coach";
  if (t === MEMBER_TYPE.Manager) return "manager";
  return "player";
}

function listPath(t: MemberType): string {
  // 選手是預設 Tab，省略參數讓 URL 乾淨
  return t === MEMBER_TYPE.Player ? "/players" : `/players?tab=${memberTypeToUrl(t)}`;
}

function ToggleChips({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: { value: string; label: string; sub?: string }[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = multi ? (value as string[]) : value ? [value as string] : [];

  const toggle = (v: string) => {
    if (multi) {
      const arr = selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v];
      onChange(arr);
    } else {
      onChange(selected.includes(v) ? "" : v);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors select-none
              ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
          >
            {o.label}
            {o.sub && (
              <span
                className={`ml-1 text-xs ${active ? "opacity-80" : "text-muted-foreground"}`}
              >
                ({o.sub})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function PlayerEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const canEdit = useAuthStore((s) => s.can(PERM.PlayersEdit));
  const canPurgePerm = useAuthStore((s) => s.can(PERM.PlayersPurge));
  const canSave = canEdit;
  const canPurge = !isNew && canPurgePerm;

  const { busy, run } = useBusy();

  const { data } = useQuery({
    queryKey: ["players", id],
    queryFn: () => playersApi.get(Number(id)),
    enabled: !isNew,
  });

  const defaultMemberType: MemberType = isNew
    ? parseMemberTypeParam(searchParams.get("type"))
    : MEMBER_TYPE.Player;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Inputs, unknown, Outputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      isActive: PLAYER_STATUS.Active,
      memberType: defaultMemberType,
      name: "",
      studentId: "",
      nickname: "",
      positions: [],
      dominantHand: "",
    },
  });

  const { field: positionsField } = useController({
    name: "positions",
    control,
  });
  const { field: handField } = useController({ name: "dominantHand", control });
  const { field: birthDateField } = useController({ name: "birthDate", control });
  const { field: statusField } = useController({ name: "isActive", control });
  const { field: memberTypeField } = useController({ name: "memberType", control });

  const memberTypeValue = Number(memberTypeField.value ?? defaultMemberType) as MemberType;
  const isPlayerType = memberTypeValue === MEMBER_TYPE.Player;
  const isCoachType = memberTypeValue === MEMBER_TYPE.Coach;
  // 教練不需要學號與系級；選手與球經需要
  const showStudentId = !isCoachType;
  const showGrade = !isCoachType;
  const memberLabel = MEMBER_TYPE_LABEL[memberTypeValue] ?? "人員";

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        studentId: data.studentId ?? "",
        nickname: data.nickname ?? "",
        jerseyNo: data.jerseyNo,
        positions: data.position
          ? data.position
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        heightCm: data.heightCm,
        dominantHand: data.dominantHand ?? "",
        birthDate: data.birthDate?.slice(0, 10) ?? null,
        grade: data.grade ?? null,
        isActive: data.isActive,
        memberType: data.memberType ?? MEMBER_TYPE.Player,
        notes: data.notes,
      });
    }
  }, [data, reset]);

  const onSubmit = async (v: Outputs) => {
    const treatAsPlayer = v.memberType === MEMBER_TYPE.Player;
    const treatAsCoach = v.memberType === MEMBER_TYPE.Coach;
    const payload: PlayerUpsert = {
      name: v.name,
      studentId: treatAsCoach ? null : (v.studentId?.trim() ? v.studentId.trim() : null),
      nickname: v.nickname?.trim() ? v.nickname.trim() : null,
      jerseyNo: treatAsPlayer ? (v.jerseyNo ?? null) : null,
      position: treatAsPlayer && v.positions.length > 0 ? v.positions.join(",") : null,
      heightCm: treatAsPlayer ? (v.heightCm ?? null) : null,
      dominantHand: treatAsPlayer ? (v.dominantHand || null) : null,
      birthDate: v.birthDate ? `${v.birthDate}T00:00:00` : null,
      grade: treatAsCoach ? null : (v.grade ?? null),
      isActive: v.isActive,
      memberType: v.memberType,
      notes: v.notes || null,
    };
    try {
      if (isNew) await playersApi.create(payload);
      else await playersApi.update(Number(id), payload);
      await qc.invalidateQueries({ queryKey: ["players"] });
      await showSuccess("儲存成功");
      // 用「剛存的身份」回到對應 Tab，若使用者把選手改成教練則跳到教練 Tab
      navigate(listPath(v.memberType));
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      showError(m ?? "儲存失敗");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {isNew ? `新增人員 · ${memberLabel}` : `編輯人員 · ${memberLabel}`}
        </CardTitle>
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
          {/* 送出/刪除進行中時,整個表單欄位與按鈕一律鎖定 */}
          <fieldset
            disabled={isSubmitting || busy}
            className="space-y-4 min-w-0 border-0 p-0 m-0"
          >
          <div className="space-y-2">
            <Label>身份</Label>
            <ToggleChips
              options={MEMBER_TYPE_OPTIONS}
              value={String(memberTypeField.value ?? MEMBER_TYPE.Player)}
              onChange={(v) => {
                if (v === "" || v == null) return;
                memberTypeField.onChange(Number(v) as MemberType);
              }}
            />
            {errors.memberType && (
              <p className="text-sm text-destructive">{errors.memberType.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            {showStudentId && (
              <div className="space-y-2">
                <Label htmlFor="studentId">
                  學號 <span className="text-xs text-muted-foreground font-normal">（選填,需唯一）</span>
                </Label>
                <Input id="studentId" placeholder="例:1131234567" autoComplete="off" {...register("studentId")} />
                {errors.studentId && (
                  <p className="text-sm text-destructive">
                    {errors.studentId.message}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="nickname">
                暱稱 <span className="text-xs text-muted-foreground font-normal">（選填,最多 32 字）</span>
              </Label>
              <Input id="nickname" placeholder="例:阿明" {...register("nickname")} />
              {errors.nickname && (
                <p className="text-sm text-destructive">
                  {errors.nickname.message}
                </p>
              )}
            </div>
            {isPlayerType && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="jerseyNo">背號（1–99）</Label>
                  <Input
                    id="jerseyNo"
                    type="number"
                    min={1}
                    max={99}
                    {...register("jerseyNo")}
                  />
                  {errors.jerseyNo && (
                    <p className="text-sm text-destructive">
                      {errors.jerseyNo.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heightCm">身高 (cm)</Label>
                  <Input id="heightCm" type="number" {...register("heightCm")} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>生日 <span className="text-xs text-muted-foreground font-normal">（選填）</span></Label>
              <DateInput value={birthDateField.value} onChange={birthDateField.onChange} />
            </div>
            {showGrade && (
              <div className="space-y-2">
                <Label htmlFor="grade">系級（例:110）</Label>
                <Input
                  id="grade"
                  type="number"
                  placeholder="109"
                  {...register("grade")}
                />
                {errors.grade && (
                  <p className="text-sm text-destructive">
                    {errors.grade.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {isPlayerType && (
            <>
              <div className="space-y-2">
                <Label>位置（可多選）<span className="text-xs text-muted-foreground font-normal ml-1">（選填）</span></Label>
                <ToggleChips
                  options={POSITIONS}
                  value={positionsField.value ?? []}
                  onChange={positionsField.onChange}
                  multi
                />
              </div>

              <div className="space-y-2">
                <Label>慣用手</Label>
                <ToggleChips
                  options={HANDS}
                  value={handField.value ?? ""}
                  onChange={handField.onChange}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">備註</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
          <div className="space-y-2">
            <Label>狀態</Label>
            <ToggleChips
              options={STATUS_OPTIONS}
              value={String(statusField.value ?? PLAYER_STATUS.Active)}
              onChange={(v) => {
                if (v === "" || v == null) return; // 狀態不可清空
                statusField.onChange(Number(v) as PlayerStatus);
              }}
            />
            {errors.isActive && (
              <p className="text-sm text-destructive">{errors.isActive.message}</p>
            )}
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
              onClick={() => {
                // 取消／返回：用「進入頁時的身份」決定回到哪個 Tab
                // - 編輯模式：以 data.memberType 為準（即使表單上切過身份，按取消就不算）
                // - 新增模式：以 URL ?type= 為準（defaultMemberType 已涵蓋）
                const back = data?.memberType ?? defaultMemberType;
                navigate(listPath(back));
              }}
            >
              {canSave ? "取消" : "返回"}
            </Button>
            <div className="ml-auto flex gap-2">
              {canPurge && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isSubmitting || busy}
                  onClick={() => run(async () => {
                    const result = await confirmAction(
                      `確定永久刪除此${memberLabel}？`,
                      "所有相關紀錄將一併移除，此操作無法復原。",
                      "永久刪除",
                      true,
                    );
                    if (!result.isConfirmed) return;
                    try {
                      await playersApi.purge(Number(id));
                      await qc.invalidateQueries({ queryKey: ["players"] });
                      await showSuccess(`已刪除${memberLabel}`);
                      // 刪除後人員已不存在，跳回該身份對應 Tab
                      navigate(listPath(data?.memberType ?? defaultMemberType));
                    } catch (e: unknown) {
                      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
                      showError(m ?? "刪除失敗");
                    }
                  })}
                >
                  刪除此{memberLabel}
                </Button>
              )}
            </div>
          </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
