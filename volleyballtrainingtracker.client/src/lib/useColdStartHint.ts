import { useEffect, useState } from 'react';

export interface ColdStartHintState {
  /** 是否該顯示提示（active 持續超過 delayMs 後才為 true） */
  show: boolean;
  /** 已等待秒數 */
  elapsed: number;
  /** 依等待時間漸進切換的鼓勵文案 */
  message: string;
}

/** 依已等待秒數切換的階段文案（由小到大） */
const STAGES: ReadonlyArray<{ atLeast: number; message: string }> = [
  { atLeast: 0, message: '正在喚醒伺服器…' },
  { atLeast: 8, message: '伺服器休眠後首次連線約需 30–60 秒，請稍候…' },
  { atLeast: 25, message: '就快好了，感謝你的耐心等候 🙏' },
];

function messageFor(elapsed: number): string {
  let msg = STAGES[0].message;
  for (const stage of STAGES) {
    if (elapsed >= stage.atLeast) msg = stage.message;
  }
  return msg;
}

/**
 * 當 active 持續超過 delayMs 後，回傳漸進式「後端喚醒中」提示狀態。
 *
 * 後端若已喚醒，請求通常數百毫秒內完成、active 很快轉 false，提示不會顯示，
 * 故 delayMs 用來避免在正常情況下閃一下提示。
 *
 * @param active 是否正在等待（通常傳入送出／載入狀態）
 * @param delayMs 超過多久才顯示提示，預設 4 秒
 */
export function useColdStartHint(active: boolean, delayMs = 4_000): ColdStartHintState {
  const [elapsed, setElapsed] = useState(0);
  const [show, setShow] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  // active 由等待轉為閒置時，於 render 期間即時歸零。
  // 這是 React 官方建議的「依前一次 prop 調整 state」寫法，
  // 可避免在 effect 內同步 setState 造成連鎖渲染。
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) {
      setElapsed(0);
      setShow(false);
    }
  }

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(Math.floor(ms / 1000));
      setShow(ms >= delayMs);
    }, 500);
    return () => clearInterval(id);
  }, [active, delayMs]);

  return { show, elapsed, message: messageFor(elapsed) };
}
