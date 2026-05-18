import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  items: NavItem[];
}

export default function BottomTabBar({ items }: Props) {
  const tabs = items.slice(0, 5);
  if (tabs.length === 0) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="主選單"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((item) => (
          <li key={item.to} className="flex">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b bg-primary" />
                  )}
                  <item.icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                  <span className="leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
