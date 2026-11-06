import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SheetRow } from '@/lib/scoresheet/sheet';
import { StatGrid } from './StatGrid';

const ROWS: SheetRow[] = [
  { playerId: 7, name: '小美', jerseyNo: 12, counts: { serveO: 2, atkNo: 4 } },
  { playerId: 9, name: '小華', jerseyNo: 3, counts: {} },
];

const cell = (name: string) => screen.getByRole('button', { name });

describe('StatGrid', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders group headers and sub labels in paper order', () => {
    render(<StatGrid rows={ROWS} oppErrors={0} ourErrors={0} />);
    const [groupRow, subRow] = screen.getAllByRole('row');
    const groups = within(groupRow).getAllByRole('columnheader').map((th) => th.textContent);
    expect(groups).toEqual([
      '隊員', '發球', '攻擊/舉球', '吊球', '接發', '接扣', '接小', '修正', '攔網', 'Cover/鬆把', '犯規',
    ]);
    const subs = within(subRow).getAllByRole('columnheader').map((th) => th.textContent);
    expect(subs).toEqual(['O', 'X', 'O', 'no', 'out', 'O', 'X', 'X', '未', '噴', 'X', 'X', 'O', 'X', 'X', '']);
  });

  it('shows counts and row name', () => {
    render(<StatGrid rows={ROWS} oppErrors={3} ourErrors={2} />);
    expect(cell('小美 發球 O')).toHaveTextContent('2');
    expect(cell('小美 攻擊/舉球 no')).toHaveTextContent('4');
    expect(cell('對方失誤')).toHaveTextContent('3');
    expect(cell('我方失誤')).toHaveTextContent('2');
  });

  it('tap increments a cell', () => {
    const onBump = vi.fn();
    render(<StatGrid rows={ROWS} oppErrors={0} ourErrors={0} onBump={onBump} />);
    const c = cell('小美 發球 O');
    fireEvent.pointerDown(c);
    fireEvent.pointerUp(c);
    expect(onBump).toHaveBeenCalledTimes(1);
    expect(onBump).toHaveBeenCalledWith(7, 'serveO', 1);
  });

  it('long press decrements once and does not also increment', () => {
    const onBump = vi.fn();
    render(<StatGrid rows={ROWS} oppErrors={0} ourErrors={0} onBump={onBump} />);
    const c = cell('小美 發球 O');
    fireEvent.pointerDown(c);
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.pointerUp(c);
    expect(onBump).toHaveBeenCalledTimes(1);
    expect(onBump).toHaveBeenCalledWith(7, 'serveO', -1);
  });

  it('pointer leaving before release cancels the tap', () => {
    const onBump = vi.fn();
    render(<StatGrid rows={ROWS} oppErrors={0} ourErrors={0} onBump={onBump} />);
    const c = cell('小美 發球 O');
    fireEvent.pointerDown(c);
    fireEvent.pointerCancel(c);
    fireEvent.pointerUp(c);
    act(() => { vi.advanceTimersByTime(600); });
    expect(onBump).not.toHaveBeenCalled();
  });

  it('error counters tap +1 and long press -1', () => {
    const onBumpErrors = vi.fn();
    render(<StatGrid rows={ROWS} oppErrors={1} ourErrors={1} onBumpErrors={onBumpErrors} />);
    fireEvent.pointerDown(cell('對方失誤'));
    fireEvent.pointerUp(cell('對方失誤'));
    fireEvent.pointerDown(cell('我方失誤'));
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.pointerUp(cell('我方失誤'));
    expect(onBumpErrors.mock.calls).toEqual([['opp', 1], ['our', -1]]);
  });

  it('remove row button calls onRemoveRow', () => {
    const onRemoveRow = vi.fn();
    render(<StatGrid rows={ROWS} oppErrors={0} ourErrors={0} onRemoveRow={onRemoveRow} />);
    fireEvent.click(screen.getByRole('button', { name: '移除 小華' }));
    expect(onRemoveRow).toHaveBeenCalledWith(9);
  });

  it('readOnly renders no handlers', () => {
    const onBump = vi.fn();
    const onBumpErrors = vi.fn();
    const onRemoveRow = vi.fn();
    render(
      <StatGrid rows={ROWS} oppErrors={3} ourErrors={0} readOnly
        onBump={onBump} onBumpErrors={onBumpErrors} onRemoveRow={onRemoveRow} />,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const two = screen.getByText('2');
    fireEvent.pointerDown(two);
    fireEvent.pointerUp(two);
    expect(onBump).not.toHaveBeenCalled();
    expect(screen.getByText('小美')).toBeInTheDocument();
  });
});
