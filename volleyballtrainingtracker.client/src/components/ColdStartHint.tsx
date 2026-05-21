import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColdStartHintState } from '@/lib/useColdStartHint';

/**
 * 後端喚醒（cold start）等待提示卡：旋轉圖示 ＋ 漸進文案 ＋ 估計進度條。
 * 進度條以 60 秒為基準估算、封頂 95%，給使用者「正在前進」的感受。
 */
export default function ColdStartHint({
  state,
  className,
}: {
  state: ColdStartHintState;
  className?: string;
}) {
  if (!state.show) return null;

  const pct = Math.min(95, Math.round((state.elapsed / 60) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm animate-slide-up',
        className,
      )}
    >
      <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin text-primary" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-foreground">{state.message}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">已等待 {state.elapsed} 秒</p>
      </div>
    </div>
  );
}
