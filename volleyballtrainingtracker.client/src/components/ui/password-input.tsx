import * as React from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * 密碼輸入框：附「顯示／隱藏密碼」切換按鈕，並可選擇性提供「清除」按鈕。
 * - 圖示語意採直覺對應：睜眼＝目前看得到密碼、閉眼＝目前看不到。
 * - 預設隱藏；ref 會轉發到內部 <input>，可直接搭配 react-hook-form 的 register()。
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    /** 是否顯示清除按鈕（通常綁定「欄位有值且非送出中」）。 */
    showClear?: boolean;
    /** 按下清除按鈕時呼叫；清除後會自動將焦點移回輸入框。 */
    onClear?: () => void;
  }
>(({ className, disabled, showClear, onClear, ...props }, ref) => {
  const [show, setShow] = React.useState(false);
  const innerRef = React.useRef<HTMLInputElement | null>(null);

  // 合併對外 ref（給 RHF）與內部 ref（清除後聚焦用）。
  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  const canClear = !!showClear && !disabled && !!onClear;

  return (
    <div className="relative">
      <Input
        ref={innerRef}
        type={show ? 'text' : 'password'}
        disabled={disabled}
        className={cn(canClear ? 'pr-16' : 'pr-10', className)}
        {...props}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {canClear && (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              onClear?.();
              innerRef.current?.focus();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="清除密碼"
            title="清除密碼"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setShow((v) => !v)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={show ? '隱藏密碼' : '顯示密碼'}
          title={show ? '隱藏密碼' : '顯示密碼'}
        >
          {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
