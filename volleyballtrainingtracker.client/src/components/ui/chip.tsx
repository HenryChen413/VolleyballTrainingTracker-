import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        primary: 'bg-primary/10 text-primary',
        navy: 'bg-navy/10 text-navy',
        success: 'bg-success/10 text-success',
        destructive: 'bg-destructive/10 text-destructive',
        warning: 'bg-warning/15 text-warning',
        info: 'bg-info/10 text-info',
        outline: 'border border-border text-foreground',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

export function Chip({ className, tone, size, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone, size }), className)} {...props} />;
}
