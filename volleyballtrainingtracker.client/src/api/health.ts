// 後端喚醒（cold start）暖機工具。
// Render 免費方案閒置後會休眠，首次請求需 30–60 秒喚醒；提前對 /health 發一次
// 輕量請求，可讓後端在使用者操作前就開始醒來。
//
// 注意：
//  - /health 在後端「根路徑」，不在 /api 之下，故這裡自行組網址，不走 api client。
//  - 不需要（也不應）帶 token，因此用原生 fetch，避開 axios 攔截器的 401 處理。
//  - 本機開發（VITE_API_URL 為空）打相對路徑 /health，由 Vite dev proxy 轉發到後端。

const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const HEALTH_URL = `${base}/health`;

/**
 * Fire-and-forget 喚醒後端。成功回 true，逾時／失敗回 false（靜默，不拋錯）。
 * @param timeoutMs 單次嘗試逾時（毫秒），預設 60 秒涵蓋 cold start。
 */
export async function pingHealth(timeoutMs = 60_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
