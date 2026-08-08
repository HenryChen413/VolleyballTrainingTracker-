import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore, type ToastItem, type ToastTone } from '@/lib/toast';

/** iOS 舊版 iPad 只認 webkit 前綴，寫法比照 src/lib/useFullscreen.ts 的型別補丁。 */
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

/** 目前全螢幕元素（原生全螢幕才有值），沒有全螢幕時退回 document.body。 */
function getFullscreenTarget(): HTMLElement {
  const doc = document as FullscreenDocument;
  return (document.fullscreenElement as HTMLElement | null) ?? (doc.webkitFullscreenElement as HTMLElement | null) ?? document.body;
}

const ICONS: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_CLS: Record<ToastTone, string> = {
  success: 'border-success/30 bg-success/5 text-success',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
  warning: 'border-warning/30 bg-warning/5 text-warning',
  info: 'border-info/30 bg-info/5 text-info',
};

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICONS[item.tone];

  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration, dismiss]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-start gap-3 w-full rounded-lg border bg-card text-card-foreground shadow-lift p-3 pr-2 animate-slide-down',
        TONE_CLS[item.tone],
      )}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-foreground">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        )}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={item.action.onClick}
          className="shrink-0 self-center rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent transition"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        className="text-muted-foreground hover:text-foreground rounded-md p-1 transition"
        aria-label="關閉"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const items = useToastStore((s) => s.items);

  // 戰術板專注模式期間，toast 容器必須 portal 到「目前的全螢幕元素」，
  // 否則兩條全螢幕路徑都會蓋掉／遮住 toast：
  // - 原生全螢幕：全螢幕元素被瀏覽器提升到 top layer，其餘文件（含掛在
  //   document.body 的原本容器）直接被遮蔽，toast 根本不會被畫出來。
  // - CSS 假全螢幕：overlay 是 fixed inset-0 z-[100] 的不透明底色，
  //   若 toast 容器 z-index 比它低就會被完全蓋住看不到
  //   （下面把容器提到 z-[110] 蓋過 z-[100] 來因應這條路徑）。
  // 用 state 存目標節點，fullscreenchange／webkitfullscreenchange 觸發時
  // 重新讀取，確保進出全螢幕都能即時切換 portal 目標。
  const [target, setTarget] = useState<HTMLElement>(() =>
    typeof document === 'undefined' ? (null as unknown as HTMLElement) : getFullscreenTarget(),
  );

  useEffect(() => {
    const sync = () => setTarget(getFullscreenTarget());
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[110] w-80 max-w-[calc(100vw-2rem)] flex flex-col items-center gap-2 pointer-events-none"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>,
    target,
  );
}
