import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

const ORDER: ThemeMode[] = ['light', 'dark', 'system'];
const ICONS: Record<ThemeMode, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};
const LABELS: Record<ThemeMode, string> = {
  light: '淺色',
  dark: '深色',
  system: '系統',
};

interface Props {
  className?: string;
}

export default function ThemeToggle({ className }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const Icon = ICONS[mode];

  const cycle = () => {
    const idx = ORDER.indexOf(mode);
    const next = ORDER[(idx + 1) % ORDER.length];
    setMode(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      title={`目前：${LABELS[mode]}（點擊切換）`}
      aria-label={`切換主題（目前：${LABELS[mode]}）`}
      className={cn('relative', className)}
    >
      <Icon className="h-4 w-4 transition-all" />
    </Button>
  );
}
