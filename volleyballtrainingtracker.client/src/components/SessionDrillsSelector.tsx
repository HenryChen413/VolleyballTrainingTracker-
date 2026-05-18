import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { drillsApi } from '@/api/drills';

interface Props {
  value: number[];
  onChange: (next: number[]) => void;
  readOnly?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  Basic: '基礎',
  Serve: '發球',
  Pass: '接發球',
  Set: '舉球',
  Attack: '攻擊',
  Block: '攔網',
  Dig: '防守',
  Fitness: '體能',
};

const CATEGORY_ORDER = ['Basic', 'Serve', 'Pass', 'Set', 'Attack', 'Block', 'Dig', 'Fitness'];

export default function SessionDrillsSelector({ value, onChange, readOnly }: Props) {
  const { data: drills } = useQuery({ queryKey: ['drills'], queryFn: () => drillsApi.list(true) });

  const selected = useMemo(() => new Set(value), [value]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof drills>();
    for (const d of drills ?? []) {
      const arr = m.get(d.category) ?? [];
      arr.push(d);
      m.set(d.category, arr);
    }
    return m;
  }, [drills]);

  const orderedCategories = useMemo(() => {
    const keys = Array.from(grouped.keys());
    return keys.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }, [grouped]);

  const toggle = (id: number) => {
    if (readOnly) return;
    if (selected.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">已選 {selected.size} 項</span>
      </div>
      {(drills?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">尚無可選的訓練項目</p>
      ) : (
        <div className="space-y-4">
          {orderedCategories.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 border-b border-border pb-1">
                  {CATEGORY_LABELS[cat] ?? cat}
                  <span className="ml-2 font-normal">{items.length} 項</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                  {items.map((d) => {
                    const isSelected = selected.has(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggle(d.id)}
                        disabled={readOnly}
                        className={[
                          'relative text-left rounded-lg border px-3 py-2 transition-all',
                          'focus:outline-none focus:ring-2 focus:ring-ring',
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border bg-card hover:bg-accent/50',
                          readOnly ? 'cursor-default opacity-90' : 'cursor-pointer',
                        ].join(' ')}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <div className="pr-6">
                          <div className="text-sm font-medium leading-snug">{d.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
