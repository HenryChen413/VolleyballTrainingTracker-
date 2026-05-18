import * as React from 'react';
import { X } from 'lucide-react';
import { Card } from './card';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: DialogProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const first = contentRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
      );
      first?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <Card
        ref={contentRef}
        className={cn(
          'w-full overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]',
          SIZE_CLASS[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 p-5 pb-4 border-b">
            <div className="space-y-1">
              {title && (
                <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="關閉"
              className="-mr-2 -mt-2 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
}
