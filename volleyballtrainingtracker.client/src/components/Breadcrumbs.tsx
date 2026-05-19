import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { ALL_NAV } from '@/config/nav';
import { cn } from '@/lib/utils';

const EDIT_LABELS: Record<string, string> = {
  '/players/new': '新增選手',
  '/sessions/new': '新增訓練',
  '/match-logs/new': '新增比賽',
};

function deriveCrumbs(pathname: string): { label: string; to?: string }[] {
  if (pathname === '/' || pathname === '') return [{ label: '儀表板' }];

  const crumbs: { label: string; to?: string }[] = [];
  const navItem = ALL_NAV.find((n) => pathname === n.to || (n.to !== '/' && pathname.startsWith(n.to)));
  if (navItem) crumbs.push({ label: navItem.label, to: navItem.to });

  // 編輯 / 新增頁
  if (pathname.endsWith('/new')) {
    crumbs.push({ label: EDIT_LABELS[pathname] ?? '新增' });
  } else if (/\/\d+$/.test(pathname)) {
    crumbs.push({ label: '編輯' });
  } else if (pathname === '/profile') {
    crumbs.length = 0;
    crumbs.push({ label: '我的帳號' });
  } else if (pathname === '/no-access') {
    crumbs.length = 0;
    crumbs.push({ label: '無權限' });
  }

  return crumbs;
}

interface Props {
  className?: string;
}

export default function Breadcrumbs({ className }: Props) {
  const { pathname } = useLocation();
  const crumbs = deriveCrumbs(pathname);

  return (
    <nav aria-label="麵包屑" className={cn('flex items-center gap-1 text-sm text-muted-foreground min-w-0', className)}>
      <Link to="/" className="inline-flex items-center hover:text-foreground transition shrink-0" aria-label="回首頁">
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1 min-w-0">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            {c.to && !isLast ? (
              <Link to={c.to} className="hover:text-foreground transition truncate">
                {c.label}
              </Link>
            ) : (
              <span className={cn('truncate', isLast && 'text-foreground font-medium')}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
