import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
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

/**
 * Radix 版 Dialog：保留原本 props API（open / onClose / title…）。
 * 焦點陷阱、捲動鎖定、Esc 關閉、進出場動畫皆由 Radix + tailwindcss-animate 處理。
 */
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
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          // 無 description 時明確關閉 aria-describedby，避免 Radix 對不存在的
          // 描述元素發出警告；有 description 時不傳此 prop，交由 Radix 自動連結。
          {...(description ? {} : { 'aria-describedby': undefined })}
          onInteractOutside={(e) => {
            if (!closeOnBackdrop) e.preventDefault();
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'max-h-[calc(100dvh-2rem)] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lift',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            SIZE_CLASS[size],
          )}
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 border-b p-5 pb-4">
              <div className="space-y-1">
                {title && (
                  <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="關閉"
                  className="-mr-2 -mt-2 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          )}
          {/* 無標題時仍提供無障礙標題（視覺隱藏） */}
          {!title && (
            <DialogPrimitive.Title className="sr-only">對話框</DialogPrimitive.Title>
          )}
          <div className="overflow-y-auto p-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
