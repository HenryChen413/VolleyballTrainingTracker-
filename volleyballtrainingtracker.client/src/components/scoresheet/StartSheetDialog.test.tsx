// 從賽事直接開始記錄單：分隊先選 A/B、對手可點選既有對手、送出後導向該局
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { scoreSheetsApi } from '@/api/scoreSheets';
import type { MatchLogItem } from '@/api/matchLogs';
import { showError } from '@/lib/swal';
import { StartSheetDialog } from './StartSheetDialog';

vi.mock('@/lib/swal', () => ({ showError: vi.fn() }));

vi.mock('@/api/scoreSheets', async (orig) => {
  const actual = await orig<typeof import('@/api/scoreSheets')>();
  return { ...actual, scoreSheetsApi: { ...actual.scoreSheetsApi, start: vi.fn() } };
});

const start = vi.mocked(scoreSheetsApi.start);

const match = (id: number, opponent: string, ourSquad: string | null): MatchLogItem => ({
  id,
  opponent,
  ourSquad,
  set1Our: null, set1Opp: null, set2Our: null, set2Opp: null, set3Our: null, set3Opp: null,
  ourScore: null,
  opponentScore: null,
  result: null,
  matchDate: null,
  sets: [],
  sheetCount: 0,
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function setup(props: { squadCount: number; matches: MatchLogItem[] }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/match-logs']}>
        <Routes>
          <Route
            path="/match-logs"
            element={<StartSheetDialog open onClose={onClose} eventId={3} {...props} />}
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
}

const opponentInput = () => screen.getByLabelText('對手');
const submit = () => screen.getByRole('button', { name: '開始記錄' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StartSheetDialog', () => {
  it('single squad: no squad choice, lists existing opponents', () => {
    setup({ squadCount: 1, matches: [match(1, '成大', null), match(2, '中山', null)] });
    expect(screen.queryByRole('radio', { name: 'A 隊' })).toBeNull();
    expect(screen.getByRole('button', { name: '成大' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '中山' })).toBeInTheDocument();
  });

  it('dedupes opponents with the same name', () => {
    setup({ squadCount: 1, matches: [match(1, '成大', null), match(2, ' 成大 ', null)] });
    expect(screen.getAllByRole('button', { name: '成大' })).toHaveLength(1);
  });

  it('clicking an existing opponent fills the input', () => {
    setup({ squadCount: 1, matches: [match(1, '成大', null)] });
    fireEvent.click(screen.getByRole('button', { name: '成大' }));
    expect(opponentInput()).toHaveValue('成大');
  });

  it('split squad: must choose A or B before submitting, and options follow the squad', () => {
    setup({ squadCount: 2, matches: [match(1, '成大', 'A'), match(2, '中山', 'B')] });
    fireEvent.change(opponentInput(), { target: { value: '輔大' } });
    expect(submit()).toBeDisabled();
    // 未選隊別前不列既有對手
    expect(screen.queryByRole('button', { name: '成大' })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'B 隊' }));
    expect(submit()).toBeEnabled();
    expect(screen.getByRole('button', { name: '中山' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '成大' })).toBeNull();
  });

  it('empty opponent cannot submit', () => {
    setup({ squadCount: 1, matches: [] });
    fireEvent.change(opponentInput(), { target: { value: '   ' } });
    expect(submit()).toBeDisabled();
  });

  it('submits and navigates to the returned set', async () => {
    start.mockResolvedValue({ matchLogId: 9, setIndex: 2, created: false });
    const { invalidate } = setup({ squadCount: 2, matches: [match(9, '成大', 'A')] });
    fireEvent.click(screen.getByRole('radio', { name: 'A 隊' }));
    fireEvent.click(screen.getByRole('button', { name: '成大' }));
    fireEvent.click(submit());

    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/9/sheets/2'),
    );
    expect(start).toHaveBeenCalledWith(3, { opponent: '成大', ourSquad: 'A' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['match-events'] });
  });

  it('single squad sends ourSquad null', async () => {
    start.mockResolvedValue({ matchLogId: 12, setIndex: 1, created: true });
    setup({ squadCount: 1, matches: [] });
    fireEvent.change(opponentInput(), { target: { value: ' 輔大 ' } });
    fireEvent.click(submit());
    await waitFor(() => expect(start).toHaveBeenCalledWith(3, { opponent: '輔大', ourSquad: null }));
  });

  it('shows an error and stays open when the request fails', async () => {
    start.mockRejectedValue({ response: { status: 400, data: { message: '請填寫對手' } } });
    const { onClose } = setup({ squadCount: 1, matches: [] });
    fireEvent.change(opponentInput(), { target: { value: '輔大' } });
    fireEvent.click(submit());
    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });
});
