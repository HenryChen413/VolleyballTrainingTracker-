import type { ServeSide } from '@/lib/scoresheet/sheet';
import { cn } from '@/lib/utils';

interface FirstServeSwitchProps {
  value: ServeSide | null;
  onChange: (side: ServeSide) => void;
}

const SIDES: { side: ServeSide; label: string }[] = [
  { side: 'U', label: '我方' },
  { side: 'O', label: '對方' },
];

/**
 * 開局先發球：左右滑動式切換。未指定時兩邊都不亮；
 * 點任一邊，滑塊移到該邊（我方在左、對方在右）。
 */
export function FirstServeSwitch({ value, onChange }: FirstServeSwitchProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <span>先發球</span>
      <div
        role="radiogroup"
        aria-label="開局先發球"
        className="relative grid h-11 w-28 select-none grid-cols-2 rounded-full border bg-muted p-1 touch-manipulation [-webkit-touch-callout:none]"
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow transition-all duration-200 ease-out',
            value === 'O' && 'translate-x-full',
            value == null && 'opacity-0',
          )}
        />
        {SIDES.map(({ side, label }) => (
          <button
            key={side}
            type="button"
            role="radio"
            aria-checked={value === side}
            onClick={() => onChange(side)}
            className={cn(
              'relative z-10 rounded-full text-sm font-medium transition-colors',
              value === side ? 'text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
