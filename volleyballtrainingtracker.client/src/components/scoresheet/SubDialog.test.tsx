// 換人視窗：先選下場（場上的人）、再選上場（場下的本局球員或名單上尚未加入者）；可刪除既有換人
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { SheetRosterPlayer } from '@/api/scoreSheets';
import { addRow, addSub, emptyContent, setLineup, type SheetContent } from '@/lib/scoresheet/sheet';
import { SubDialog } from './SubDialog';

const P = (playerId: number, jerseyNo: number | null, name: string): SheetRosterPlayer => ({
  playerId, jerseyNo, name, position: null,
});
const ROSTER = [P(1, 1, '小美'), P(2, 2, '小華'), P(3, 3, '小芳'), P(4, 4, '小玲')];

function content(): SheetContent {
  let c = emptyContent();
  for (const p of ROSTER.slice(0, 3)) c = addRow(c, p);
  c = setLineup(c, 0, 1);
  c = setLineup(c, 1, 2);
  return c;
}

function setup(c: SheetContent) {
  const onSubmit = vi.fn();
  const onRemove = vi.fn();
  const onClose = vi.fn();
  render(<SubDialog open onClose={onClose} content={c} roster={ROSTER} onSubmit={onSubmit} onRemove={onRemove} />);
  return { onSubmit, onRemove, onClose };
}

const group = (name: string) => screen.getByRole('group', { name });
const names = (name: string) => within(group(name)).getAllByRole('button').map((b) => b.textContent);

describe('SubDialog', () => {
  it('lists on-court players as 下場 and no 上場 choices before choosing', () => {
    setup(content());
    expect(names('下場')).toEqual(['1 小美', '2 小華']);
    expect(screen.queryByRole('group', { name: '上場' })).toBeNull();
  });

  it('after choosing 下場, 上場 lists off-court rows then roster players not yet added', () => {
    const { onSubmit, onClose } = setup(content());
    fireEvent.click(within(group('下場')).getByRole('button', { name: '1 小美' }));
    expect(names('上場')).toEqual(['3 小芳', '4 小玲']);
    fireEvent.click(within(group('上場')).getByRole('button', { name: '4 小玲' }));
    expect(onSubmit).toHaveBeenCalledWith(1, { playerId: 4, name: '小玲', jerseyNo: 4 });
    expect(onClose).toHaveBeenCalled();
  });

  it('when nobody is on court, all set players can be chosen as 下場', () => {
    let c = emptyContent();
    c = addRow(addRow(c, ROSTER[0]), ROSTER[1]);
    setup(c);
    expect(names('下場')).toEqual(['1 小美', '2 小華']);
  });

  it('lists recorded subs with score and delete buttons', () => {
    const c = addSub(content(), 1, 3);
    const { onRemove } = setup(c);
    fireEvent.click(screen.getByRole('button', { name: '刪除換人 1→3' }));
    expect(onRemove).toHaveBeenCalledWith(0);
    // 1 下 3 上之後，下場名單反映目前場上
    expect(names('下場')).toEqual(['2 小華', '3 小芳']);
  });
});
