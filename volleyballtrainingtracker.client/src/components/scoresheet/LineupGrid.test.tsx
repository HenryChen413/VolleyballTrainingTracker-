// 第一球站位＋自由球員（接發自由／防守自由）：同一人不能同時出現在號位與自由
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { SheetRow } from '@/lib/scoresheet/sheet';
import { LineupGrid } from './LineupGrid';

const row = (playerId: number, name: string): SheetRow => ({ playerId, name, jerseyNo: playerId, counts: {} });
const rows = [row(1, '小美'), row(2, '小華'), row(3, '小芳')];
const empty6 = [null, null, null, null, null, null];

function setup(lineup: (number | null)[], liberos: (number | null)[]) {
  const onChange = vi.fn();
  const onLiberoChange = vi.fn();
  render(
    <LineupGrid lineup={lineup} liberos={liberos} rows={rows} onChange={onChange} onLiberoChange={onLiberoChange} />,
  );
  return { onChange, onLiberoChange };
}

const optionNames = (label: string) =>
  within(screen.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent);

describe('LineupGrid', () => {
  it('shows 接發自由 and 防守自由 selects', () => {
    setup(empty6, [null, null]);
    expect(screen.getByLabelText('接發自由')).toBeInTheDocument();
    expect(screen.getByLabelText('防守自由')).toBeInTheDocument();
  });

  it('choosing a libero reports slot and player', () => {
    const { onLiberoChange } = setup(empty6, [null, null]);
    fireEvent.change(screen.getByLabelText('防守自由'), { target: { value: '2' } });
    expect(onLiberoChange).toHaveBeenCalledWith(1, 2);
    fireEvent.change(screen.getByLabelText('接發自由'), { target: { value: '' } });
    expect(onLiberoChange).toHaveBeenCalledWith(0, null);
  });

  it('players in the lineup or the other libero slot are not offered as libero', () => {
    setup([1, null, null, null, null, null], [null, 2]);
    expect(optionNames('接發自由')).toEqual(['—', '3 小芳']);
    expect(optionNames('防守自由')).toEqual(['—', '2 小華', '3 小芳']);
  });

  it('liberos are not offered for lineup slots', () => {
    setup(empty6, [3, null]);
    expect(optionNames('1 號位')).toEqual(['—', '1 小美', '2 小華']);
  });
});
