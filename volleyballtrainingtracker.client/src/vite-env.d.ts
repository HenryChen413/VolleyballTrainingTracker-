/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 後端 API 基底網址（不含結尾斜線）。本機開發留空，由 Vite proxy 轉發。 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
