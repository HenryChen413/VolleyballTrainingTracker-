import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title = '尚無資料',
  description,
  action,
  className,
  compact = false,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 gap-2' : 'py-14 gap-3',
        className,
      )}
    >
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          compact ? 'h-10 w-10' : 'h-14 w-14',
        )}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
      </div>
      <div className="space-y-1">
        <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>
          {title}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
