// 記錄單列表頁：各局清單、刪除限制、新增導向、整場合計、空狀態
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  scoreSheetsApi,
  type MatchScoreSheetDto,
  type MatchScoreSheetsResponse,
} from '@/api/scoreSheets';
import { confirmAction } from '@/lib/swal';
import MatchScoreSheetsPage from './MatchScoreSheets';

vi.mock('@/lib/swal', () => ({
  confirmAction: vi.fn().mockResolvedValue({ isConfirmed: true }),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('@/api/scoreSheets', async (orig) => {
  const actual = await orig<typeof import('@/api/scoreSheets')>();
  return { ...actual, scoreSheetsApi: { list: vi.fn(), save: vi.fn(), remove: vi.fn() } };
});

const list = vi.mocked(scoreSheetsApi.list);
const remove = vi.mocked(scoreSheetsApi.remove);

const sheet = (setIndex: number, content: unknown): MatchScoreSheetDto => ({
  setIndex,
  recorderName: '王小明',
  content,
  version: 1,
  updatedAt: '2026-11-05T08:30:00Z',
  updatedByName: '王小明',
});

const content = (our: number, opp: number, serveO: number) => ({
  lineup: [null, null, null, null, null, null],
  rows: [{ playerId: 7, name: '小美', jerseyNo: 7, counts: { serveO } }],
  oppErrors: 0,
  ourErrors: 0,
  rally: [...Array(our).fill('U'), ...Array(opp).fill('O')],
});

const response = (sheets: MatchScoreSheetDto[]): MatchScoreSheetsResponse => ({
  matchLogId: 9,
  matchEventId: 3,
  opponent: '某某大學',
  matchDate: '2026-11-05',
  matchType: 'Friendly',
  ourSquad: null,
  roster: [],
  sheets,
});

const TWO = [sheet(1, content(25, 20, 1)), sheet(2, content(21, 25, 2))];

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/match-logs/3/games/9/sheets']}>
      <Routes>
        <Route path="/match-logs/:eventId/games/:matchLogId/sheets" element={<MatchScoreSheetsPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(confirmAction).mockResolvedValue({ isConfirmed: true } as never);
  remove.mockResolvedValue(undefined);
});

describe('MatchScoreSheetsPage', () => {
  it('lists sets with score and recorder', async () => {
    list.mockResolvedValue(response(TWO));
    renderPage();
    expect(await screen.findByText('第 1 局')).toBeInTheDocument();
    expect(screen.getByText('第 2 局')).toBeInTheDocument();
    expect(screen.getByText('VS 某某大學')).toBeInTheDocument();
    expect(screen.getAllByText('25 : 20').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/王小明/).length).toBeGreaterThan(0);
  });

  it('only last set offers delete', async () => {
    list.mockResolvedValue(response(TWO));
    renderPage();
    await screen.findByText('第 2 局');
    expect(screen.getAllByRole('button', { name: /刪除第 \d 局記錄單/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '刪除第 2 局記錄單' })).toBeInTheDocument();
  });

  it('delete confirms, calls api, clears local draft and reloads', async () => {
    list.mockResolvedValue(response(TWO));
    localStorage.setItem('scoresheet:9:2', '{"dirty":true}');
    renderPage();
    await screen.findByText('第 2 局');
    list.mockResolvedValue(response([TWO[0]]));
    fireEvent.click(screen.getByRole('button', { name: '刪除第 2 局記錄單' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(9, 2));
    expect(confirmAction).toHaveBeenCalledWith(
      '刪除第 2 局記錄單？已回填的局分不會改變。',
      expect.any(String),
      expect.any(String),
      true,
    );
    expect(localStorage.getItem('scoresheet:9:2')).toBeNull();
    await waitFor(() => expect(screen.queryByText('第 2 局')).not.toBeInTheDocument());
  });

  it('does not delete when confirm is cancelled', async () => {
    list.mockResolvedValue(response(TWO));
    vi.mocked(confirmAction).mockResolvedValue({ isConfirmed: false } as never);
    renderPage();
    await screen.findByText('第 2 局');
    fireEvent.click(screen.getByRole('button', { name: '刪除第 2 局記錄單' }));
    await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
  });

  it('add fab navigates to next set index', async () => {
    list.mockResolvedValue(response(TWO));
    renderPage();
    await screen.findByText('第 2 局');
    fireEvent.click(screen.getByRole('button', { name: '新增第 3 局' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/9/sheets/3');
  });

  it('clicking a set card opens that set', async () => {
    list.mockResolvedValue(response(TWO));
    renderPage();
    fireEvent.click(await screen.findByRole('link', { name: /第 1 局/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/9/sheets/1');
  });

  it('totals sum per player across sets', async () => {
    list.mockResolvedValue(response(TWO));
    renderPage();
    await screen.findByText('第 2 局');
    const totals = screen.getByRole('region', { name: '整場合計' });
    expect(within(totals).getByText('3')).toBeInTheDocument();
  });

  it('empty state when no sheets', async () => {
    list.mockResolvedValue(response([]));
    renderPage();
    expect(await screen.findByText('尚無記錄單')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新增第 1 局' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/9/sheets/1');
  });
});
