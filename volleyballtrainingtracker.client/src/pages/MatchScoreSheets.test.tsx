// 記錄單列表頁：各局清單、刪除限制、新增導向、整場合計、空狀態
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

let qc: QueryClient;

function renderPage() {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/match-logs/3/games/9/sheets']}>
        <Routes>
          <Route path="/match-logs/:eventId/games/:matchLogId/sheets" element={<MatchScoreSheetsPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const CACHE_KEY = 'scoresheet-list:9';
const draft = (rally: string[], dirty: boolean, baseVersion = 0) =>
  JSON.stringify({
    content: { lineup: [null, null, null, null, null, null], rows: [], oppErrors: 0, ourErrors: 0, rally },
    recorderName: '草稿人', baseVersion, dirty, savedAt: Date.parse('2026-11-05T09:00:00Z'), sent: [],
  });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  qc = new QueryClient();
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
    // 小美兩局都有上場
    expect(within(totals).getByRole('columnheader', { name: '局數' })).toBeInTheDocument();
    expect(within(totals).getByText('2')).toBeInTheDocument();
  });

  it('totals list players by jersey number ascending', async () => {
    const c = {
      ...content(1, 0, 0),
      rows: [
        { playerId: 7, name: '小美', jerseyNo: 12, counts: {} },
        { playerId: 8, name: '小華', jerseyNo: 3, counts: {} },
      ],
    };
    list.mockResolvedValue(response([sheet(1, c)]));
    renderPage();
    await screen.findByText('第 1 局');
    const totals = screen.getByRole('region', { name: '整場合計' });
    expect(within(totals).getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['3小華', '12小美']);
  });

  it('empty state when no sheets', async () => {
    list.mockResolvedValue(response([]));
    renderPage();
    expect(await screen.findByText('尚無記錄單')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新增第 1 局' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/9/sheets/1');
  });

  // ── F1：刪除後讓比賽紀錄的快取失效 ──
  it('delete invalidates match-events queries', async () => {
    list.mockResolvedValue(response(TWO));
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderPage();
    await screen.findByText('第 2 局');
    fireEvent.click(screen.getByRole('button', { name: '刪除第 2 局記錄單' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['match-events'] }));
  });

  // ── F4：離線時以快取顯示列表 ──
  it('successful load writes the list cache', async () => {
    list.mockResolvedValue(response(TWO));
    renderPage();
    await screen.findByText('第 2 局');
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!).sheets).toHaveLength(2);
  });

  it('offline: renders from cache with a banner, retry reloads', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response(TWO)));
    list.mockRejectedValue(new Error('network'));
    renderPage();
    expect(await screen.findByText('離線：顯示上次同步的資料')).toBeInTheDocument();
    expect(screen.getByText('VS 某某大學')).toBeInTheDocument();
    expect(screen.getByText('第 1 局')).toBeInTheDocument();
    expect(screen.getByText('第 2 局')).toBeInTheDocument();
    list.mockResolvedValue(response([TWO[0]]));
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.queryByText('離線：顯示上次同步的資料')).not.toBeInTheDocument());
    expect(screen.queryByText('第 2 局')).not.toBeInTheDocument();
  });

  it('offline without cache: error with retry', async () => {
    list.mockRejectedValue(new Error('network'));
    renderPage();
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
    list.mockResolvedValue(response(TWO));
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    expect(await screen.findByText('第 2 局')).toBeInTheDocument();
  });

  it('slow load (8s) with cache shows the cached list', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(response(TWO)));
      list.mockReturnValue(new Promise(() => {}));
      renderPage();
      await act(async () => { await vi.advanceTimersByTimeAsync(7999); });
      expect(screen.queryByText('離線：顯示上次同步的資料')).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(screen.getByText('離線：顯示上次同步的資料')).toBeInTheDocument();
      expect(screen.getByText('第 2 局')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offline: merges local drafts, marks unsynced and next index counts drafts', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response(TWO)));
    // 第 2 局本機有未上傳修改；第 3 局只存在於本機
    localStorage.setItem('scoresheet:9:2', draft(['U', 'U', 'U'], true, 1));
    localStorage.setItem('scoresheet:9:3', draft(['O'], true));
    list.mockRejectedValue(new Error('network'));
    renderPage();
    await screen.findByText('離線：顯示上次同步的資料');
    expect(screen.getByText('第 3 局')).toBeInTheDocument();
    expect(screen.getAllByText('3 : 0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0 : 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未同步')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '新增第 4 局' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/9/sheets/4');
  });

  it('offline: draft-only sets can be opened', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response([])));
    localStorage.setItem('scoresheet:9:1', draft(['O'], true));
    list.mockRejectedValue(new Error('network'));
    renderPage();
    fireEvent.click(await screen.findByRole('link', { name: /第 1 局/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/9/sheets/1');
  });
});
