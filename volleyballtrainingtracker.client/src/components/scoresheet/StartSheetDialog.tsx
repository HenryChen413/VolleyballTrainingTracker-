import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scoreSheetsApi } from '@/api/scoreSheets';
import type { MatchLogItem } from '@/api/matchLogs';
import { showError } from '@/lib/swal';
import { cn } from '@/lib/utils';

const SQUADS = ['A', 'B'] as const;

interface StartSheetDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: number;
  squadCount: number;
  matches: MatchLogItem[];
}

/**
 * 從賽事直接開始記錄單：分隊賽事先選 A/B，再填對手（可點選本賽事已有的對手）。
 * 選既有對手 → 接到該場對戰開下一局；新對手 → 由後端新建對戰從第 1 局開始。
 */
export function StartSheetDialog({ open, onClose, eventId, squadCount, matches }: StartSheetDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSplit = squadCount >= 2;
  const [squad, setSquad] = useState<string | null>(null);
  const [opponent, setOpponent] = useState('');
  const [busy, setBusy] = useState(false);

  // 本賽事（同隊別）已填過的對手，去除重複；分隊賽事未選隊別前不列
  const options = useMemo(() => {
    if (isSplit && !squad) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const m of matches) {
      if (isSplit && m.ourSquad !== squad) continue;
      const name = m.opponent.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
  }, [matches, isSplit, squad]);

  const name = opponent.trim();
  const canSubmit = !busy && name.length > 0 && (!isSplit || squad != null);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await scoreSheetsApi.start(eventId, { opponent: name, ourSquad: isSplit ? squad : null });
      void queryClient.invalidateQueries({ queryKey: ['match-events'] });
      navigate(`/match-logs/${eventId}/games/${r.matchLogId}/sheets/${r.setIndex}`);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showError('無法開始記錄', msg ?? '請檢查網路後再試');
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="開始記錄"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={!canSubmit}>開始記錄</Button>
        </>
      }
    >
      <div className="space-y-4">
        {isSplit && (
          <div className="space-y-2">
            <div className="text-sm font-medium">隊別</div>
            <div role="radiogroup" aria-label="隊別" className="grid grid-cols-2 gap-2">
              {SQUADS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={squad === s}
                  onClick={() => setSquad(s)}
                  className={cn(
                    'min-h-11 rounded-md border text-base font-semibold transition-colors',
                    squad === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-accent',
                  )}
                >
                  {s} 隊
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="start-sheet-opponent">對手</Label>
          <Input
            id="start-sheet-opponent"
            value={opponent}
            maxLength={128}
            placeholder="輸入對手名稱"
            onChange={(e) => setOpponent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          {options.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">本賽事已有的對手（點選即可接著記下一局）</div>
              <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOpponent(o)}
                    className={cn(
                      'min-h-11 rounded-full border px-4 text-sm transition-colors',
                      o.toLowerCase() === name.toLowerCase()
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-input bg-background hover:bg-accent',
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
