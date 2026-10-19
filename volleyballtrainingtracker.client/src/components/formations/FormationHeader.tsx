import type { ComponentType } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FormationDto } from "@/api/formations";
import type { useFormation } from "./useFormation";

type Formation = ReturnType<typeof useFormation<unknown>>;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" }) : "";

interface Props {
  title: string;
  icon: ComponentType<{ className?: string }>;
  formation: Pick<Formation, "editing" | "saving" | "conflict" | "recovered" | "updatedAt" | "updatedByName" | "startEdit" | "save" | "reload">;
  canEdit: boolean;
  /** 取消編輯（頁面負責有修改時的確認） */
  onCancel: () => void;
  /** 編輯中額外停用（例如接發頁切換體系時） */
  extra?: React.ReactNode;
}

function FormationHeader({ title, icon: Icon, formation: f, canEdit, onCancel, extra }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Icon className="h-5 w-5" />
            {title}
          </h1>
          {f.updatedAt && (
            <p className="text-xs text-muted-foreground">
              最後更新：{f.updatedByName ?? "—"} · {fmt(f.updatedAt)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {extra}
          {canEdit && !f.editing && <Button onClick={f.startEdit}>編輯</Button>}
          {f.editing && (
            <>
              <Button variant="ghost" onClick={onCancel} disabled={f.saving}>取消</Button>
              <Button onClick={f.save} disabled={f.saving}>{f.saving ? "儲存中…" : "儲存"}</Button>
            </>
          )}
        </div>
      </div>

      {f.conflict && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span className="flex-1">
            站位已被 {f.conflict.updatedByName ?? "其他人"} 於 {fmt(f.conflict.updatedAt)} 更新。你的修改仍保留在畫面上，可先記下後重新載入。
          </span>
          <Button size="sm" variant="outline" onClick={() => void f.reload()}>
            重新載入（放棄我的修改）
          </Button>
        </div>
      )}

      {f.recovered && !f.editing && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          站位資料格式異常，已載入預設。
        </div>
      )}
    </div>
  );
}

function Loading({ title, query }: { title: string; query: UseQueryResult<FormationDto> }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {query.isError ? (
          <div className="flex items-center gap-2">
            <span>站位載入失敗。</span>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>重試</Button>
          </div>
        ) : (
          <span>載入中…</span>
        )}
      </CardContent>
    </Card>
  );
}

FormationHeader.Loading = Loading;
export default FormationHeader;
