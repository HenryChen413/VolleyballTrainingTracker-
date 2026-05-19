import { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore, type ToastItem, type ToastTone } from '@/lib/toast';

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
  return (
    <div
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[60] w-80 max-w-[calc(100vw-2rem)] flex flex-col items-center gap-2 pointer-events-none"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}
