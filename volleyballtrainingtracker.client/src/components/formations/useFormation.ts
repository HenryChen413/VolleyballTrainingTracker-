import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formationsApi,
  getFormationConflict,
  type FormationConflict,
  type FormationKey,
} from "@/api/formations";
import { getApiErrorMessage } from "@/api/client";
import type { ParseResult } from "@/lib/formations/layout";
import { toast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

/**
 * 一套站位的載入／編輯草稿／儲存／衝突處理。
 * - draft 非 null 即為編輯模式；檢視模式顯示 DB 版本（或內建預設）。
 * - parse 必須是穩定參考（模組層函式），否則每次 render 都會重新解析。
 * - 409 時保留草稿並回傳 conflict，讓使用者先看到別人改了什麼再決定重新載入。
 */
export function useFormation<T>(key: FormationKey, parse: (raw: unknown) => ParseResult<T>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["formation", key], queryFn: () => formationsApi.get(key) });

  const parsed = useMemo(() => {
    if (!query.data) return null;
    const r = parse(query.data.layout);
    // 從未儲存（layout=null）用預設是正常狀態，不算格式異常
    return { layout: r.layout, recovered: query.data.layout !== null && r.recovered };
  }, [query.data, parse]);

  const [draft, setDraft] = useState<T | null>(null);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<FormationConflict | null>(null);
  // 開始編輯時的版本：儲存一律以此為 expectedVersion。不可用送出當下的 query.data.version——
  // 編輯中若背景 refetch（如 iPad 斷線重連）拿到他人的新版本，會繞過衝突檢查而覆蓋對方。
  const [baseVersion, setBaseVersion] = useState(0);
  useUnsavedGuard(dirty);

  const resetEdit = () => {
    setDraft(null);
    setDirty(false);
    setConflict(null);
  };

  const mutation = useMutation({
    mutationFn: (vars: { layout: T; expectedVersion: number }) => formationsApi.save(key, vars),
    onSuccess: (dto) => {
      queryClient.setQueryData(["formation", key], dto);
      resetEdit();
      toast.success("站位已儲存");
    },
    onError: (err) => {
      const c = getFormationConflict(err);
      if (c) setConflict(c);
      else toast.error("儲存失敗", getApiErrorMessage(err));
    },
  });

  return {
    query,
    layout: draft ?? parsed?.layout ?? null,
    editing: draft !== null,
    dirty,
    conflict,
    recovered: parsed?.recovered ?? false,
    saving: mutation.isPending,
    updatedAt: query.data?.updatedAt ?? null,
    updatedByName: query.data?.updatedByName ?? null,
    startEdit: () => {
      if (!parsed) return;
      setDraft(structuredClone(parsed.layout));
      setBaseVersion(query.data?.version ?? 0);
      setDirty(false);
      setConflict(null);
    },
    update: (fn: (prev: T) => T) => {
      setDraft((prev) => (prev ? fn(prev) : prev));
      setDirty(true);
    },
    cancel: resetEdit,
    save: () => {
      if (draft) mutation.mutate({ layout: draft, expectedVersion: baseVersion });
    },
    reload: async () => {
      resetEdit();
      await query.refetch();
    },
  };
}
