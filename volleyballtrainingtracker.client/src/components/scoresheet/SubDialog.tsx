import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { SheetRosterPlayer } from '@/api/scoreSheets';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { scoreOf } from '@/lib/scoresheet/rally';
import { onCourt, type SheetContent } from '@/lib/scoresheet/sheet';
import { cn } from '@/lib/utils';

interface SubDialogProps {
  open: boolean;
  onClose: () => void;
  content: SheetContent;
  /** 本賽事名單，用來列出尚未加入本局的球員 */
  roster: SheetRosterPlayer[];
  /** 下場 playerId、上場球員（未加入本局者由呼叫端一併加入） */
  onSubmit: (out: number, inPlayer: { playerId: number; name: string; jerseyNo: number | null }) => void;
  onRemove: (index: number) => void;
}

type P = { playerId: number; name: string; jerseyNo: number | null };

const TOUCH = 'select-none touch-manipulation';
const text = (p: P) => (p.jerseyNo != null ? `${p.jerseyNo} ${p.name}` : p.name);

/** 換人：先點下場、再點上場即完成；下方列出本局已記的換人，可刪除記錯的 */
export function SubDialog({ open, onClose, content, roster, onSubmit, onRemove }: SubDialogProps) {
  const [out, setOut] = useState<number | null>(null);

  const court = onCourt(content);
  // 站位沒填時無從得知場上是誰，下場改列本局全部球員
  const outChoices = court.size > 0 ? content.rows.filter((r) => court.has(r.playerId)) : content.rows;
  const inChoices: P[] = [
    ...content.rows.filter((r) => !court.has(r.playerId) && r.playerId !== out),
    ...roster.filter((p) => !content.rows.some((r) => r.playerId === p.playerId)),
  ];

  const labelOf = (id: number) => {
    const r = content.rows.find((x) => x.playerId === id);
    return r ? (r.jerseyNo != null ? String(r.jerseyNo) : r.name) : '?';
  };

  const close = () => {
    setOut(null);
    onClose();
  };

  const pick = (p: P) => {
    if (out == null) return;
    onSubmit(out, { playerId: p.playerId, name: p.name, jerseyNo: p.jerseyNo });
    close();
  };

  const choiceButton = (p: P, selected: boolean, onClick: () => void) => (
    <Button
      key={p.playerId}
      variant="outline"
      aria-pressed={selected}
      className={cn(TOUCH, 'h-11 justify-start', selected && 'border-primary bg-primary/10 font-semibold text-primary')}
      onClick={onClick}
    >
      {text(p)}
    </Button>
  );

  return (
    <Dialog open={open} onClose={close} title="換人">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">下場</div>
          {outChoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">請先加入隊員</p>
          ) : (
            <div role="group" aria-label="下場" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {outChoices.map((p) => choiceButton(p, out === p.playerId, () => setOut(p.playerId)))}
            </div>
          )}
        </div>

        {out != null && (
          <div className="space-y-2">
            <div className="text-sm font-medium">上場</div>
            {inChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">沒有可上場的球員</p>
            ) : (
              <div role="group" aria-label="上場" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {inChoices.map((p) => choiceButton(p, false, () => pick(p)))}
              </div>
            )}
          </div>
        )}

        {content.subs.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-sm font-medium">本局換人紀錄</div>
            <ul className="space-y-1">
              {content.subs.map((s, i) => {
                const sc = scoreOf(content.rally.slice(0, s.at));
                const pair = `${labelOf(s.out)}→${labelOf(s.in)}`;
                return (
                  <li key={i} className="flex items-center gap-2 text-sm tabular-nums">
                    <span className="w-14 text-muted-foreground">{sc.our}:{sc.opp}</span>
                    <span className="flex-1">{labelOf(s.out)} 下、{labelOf(s.in)} 上</span>
                    <button
                      type="button"
                      aria-label={`刪除換人 ${pair}`}
                      title={`刪除換人 ${pair}`}
                      onClick={() => onRemove(i)}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
