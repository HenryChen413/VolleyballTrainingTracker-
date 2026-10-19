import { api } from './client';

export type FormationKey = 'defense' | 'receive-2oh' | 'receive-oh1-opp' | 'receive-oh2-opp' | 'receive-2oh-opp';

export interface FormationDto {
  key: FormationKey;
  /** 尚未儲存過為 null（改用內建預設） */
  layout: unknown | null;
  /** 尚未儲存過為 0 */
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface FormationConflict {
  message: string;
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export const formationsApi = {
  get: (key: FormationKey) => api.get<FormationDto>(`/formations/${key}`).then((r) => r.data),
  save: (key: FormationKey, body: { layout: unknown; expectedVersion: number }) =>
    api.put<FormationDto>(`/formations/${key}`, body).then((r) => r.data),
};

/** PUT 回 409（版本不符）時取出衝突資訊；其他錯誤回 null */
export function getFormationConflict(err: unknown): FormationConflict | null {
  const e = err as { response?: { status?: number; data?: FormationConflict } };
  return e?.response?.status === 409 && e.response.data ? e.response.data : null;
}
