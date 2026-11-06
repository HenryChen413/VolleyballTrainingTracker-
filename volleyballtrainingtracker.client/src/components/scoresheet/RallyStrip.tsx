import { useEffect, useRef } from 'react';
import { layoutRally } from '@/lib/scoresheet/rally';
import type { RallyItem } from '@/lib/scoresheet/sheet';
import { cn } from '@/lib/utils';

interface RallyStripProps {
  rally: RallyItem[];
}

/**
 * 比分發展：兩列錯開寫法，每個項目佔一欄，得分方寫累計分；
 * 暫停以 Ⓣ 標在喊暫停那一方的列上（我方藍、對方紅）。新增項目時自動捲到最右。
 */
export function RallyStrip({ rally }: RallyStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  const cells = layoutRally(rally);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && rally.length >= prevLen.current) el.scrollLeft = el.scrollWidth;
    prevLen.current = rally.length;
  }, [rally.length]);

  const row = (side: 'U' | 'O', label: string) => (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card pr-2 text-left text-xs font-medium text-muted-foreground"
      >
        {label}
      </th>
      {cells.map((c, i) => {
        const isTimeout = c.timeout === side;
        return (
          <td key={i} className="h-7 w-7 min-w-7 text-center tabular-nums">
            {isTimeout ? (
              <span
                title={side === 'U' ? '我方暫停' : '對方暫停'}
                className={cn('font-semibold', side === 'U' ? 'text-info' : 'text-destructive')}
              >
                Ⓣ
              </span>
            ) : side === 'U' ? (
              c.our
            ) : (
              c.opp
            )}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <tbody>
          {row('U', '我方')}
          {row('O', '對方')}
        </tbody>
      </table>
      {rally.length === 0 && <p className="py-1 text-xs text-muted-foreground">尚未記分</p>}
    </div>
  );
}
