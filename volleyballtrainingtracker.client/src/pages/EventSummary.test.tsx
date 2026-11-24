// 賽事總結頁：戰績、各場對戰連結、隊別篩選、個人表現排序、空狀態與載入失敗
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { scoreSheetsApi, type EventSheetsResponse } from '@/api/scoreSheets';
import EventSummaryPage from './EventSummary';

vi.mock('@/api/scoreSheets', async (orig) => {
  const actual = await orig<typeof import('@/api/scoreSheets')>();
  return { ...actual, scoreSheetsApi: { eventSheets: vi.fn() } };
});

const eventSheets = vi.mocked(scoreSheetsApi.eventSheets);

const content = (our: number, opp: number, rows: unknown[] = []) => ({
  lineup: [null, null, null, null, null, null],
  rows,
  oppErrors: 0,
  ourErrors: 0,
  rally: [...Array(our).fill('U'), ...Array(opp).fill('O')],
});

const amy = (atkO: number) => ({ playerId: 7, name: '小美', jerseyNo: 7, counts: { atkO } });
const bea = (serveX: number) => ({ playerId: 8, name: '小華', jerseyNo: 3, counts: { serveX } });

const response = (matches: EventSheetsResponse['matches'], squadCount = 1): EventSheetsResponse => ({
  matchEventId: 3,
  matchName: '藥學友誼賽',
  matchDate: '2026-11-05T00:00:00Z',
  matchType: 'Friendly',
  squadCount,
  matches,
});

const TWO_OPPONENTS = response([
  {
    matchLogId: 10,
    opponent: '嘉藥A',
    ourSquad: null,
    sheets: [
      { setIndex: 1, content: content(25, 20, [amy(5)]) },
      { setIndex: 2, content: content(25, 22, [amy(4), bea(2)]) },
    ],
  },
  {
    matchLogId: 11,
    opponent: '高醫B',
    ourSquad: null,
    sheets: [
      { setIndex: 1, content: content(18, 25, [amy(1), bea(5)]) },
      { setIndex: 2, content: content(20, 25, [bea(1)]) },
    ],
  },
]);

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/match-logs/3/summary']}>
        <Routes>
          <Route path="/match-logs/:eventId/summary" element={<EventSummaryPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  eventSheets.mockReset();
});

describe('EventSummaryPage', () => {
  it('shows event record across opponents', async () => {
    eventSheets.mockResolvedValue(TWO_OPPONENTS);
    renderPage();
    expect(await screen.findByRole('heading', { name: '藥學友誼賽' })).toBeInTheDocument();
    expect(eventSheets).toHaveBeenCalledWith(3);
    const record = screen.getByRole('region', { name: '賽事戰績' });
    // 嘉藥A 2:0 勝、高醫B 0:2 負 → 1 勝 1 負、局數 2:2、總得分 88:92
    expect(record).toHaveTextContent('1勝1負');
    expect(within(record).getByText('2:2')).toBeInTheDocument();
    expect(within(record).getByText('88:92')).toBeInTheDocument();
  });

  it('lists each opponent with result and links to its sheets', async () => {
    eventSheets.mockResolvedValue(TWO_OPPONENTS);
    renderPage();
    const list = await screen.findByRole('region', { name: '各場對戰（2 場）' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('VS 嘉藥A');
    expect(links[0]).toHaveTextContent('勝');
    expect(links[1]).toHaveTextContent('VS 高醫B');
    expect(links[1]).toHaveTextContent('負');
    fireEvent.click(links[1]);
    expect(screen.getByTestId('where')).toHaveTextContent('/match-logs/3/games/11/sheets');
  });

  it('highlights name the opponent and players merge across matches', async () => {
    eventSheets.mockResolvedValue(TWO_OPPONENTS);
    renderPage();
    const players = await screen.findByRole('region', { name: '個人表現' });
    const highlights = screen.getByRole('region', { name: '本賽事重點' });
    expect(within(highlights).getByText('得分王')).toBeInTheDocument();
    expect(within(highlights).getByText('#7 小美，共 10 分')).toBeInTheDocument();
    expect(within(highlights).getByText(/對 嘉藥A 第 1 局連得/)).toBeInTheDocument();
    // 預設依淨值：小美 +10 在前、小華 −8 在後；改依背號則小華（#3）在前
    const names = () => within(players).getAllByText(/^#\d+ /).map((e) => e.textContent);
    expect(names()).toEqual(['#7 小美', '#3 小華']);
    fireEvent.click(within(players).getByRole('button', { name: '依背號' }));
    expect(names()).toEqual(['#3 小華', '#7 小美']);
  });

  it('squad filter appears when matches have different squads', async () => {
    eventSheets.mockResolvedValue(
      response(
        [
          { ...TWO_OPPONENTS.matches[0], ourSquad: 'A' },
          { ...TWO_OPPONENTS.matches[1], ourSquad: 'B' },
        ],
        2,
      ),
    );
    renderPage();
    await screen.findByRole('region', { name: '賽事戰績' });
    fireEvent.click(screen.getByRole('button', { name: 'B 隊' }));
    expect(screen.getByRole('button', { name: 'B 隊' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: '各場對戰（1 場）' })).toHaveTextContent('VS 高醫B');
    expect(screen.getByRole('region', { name: '賽事戰績' })).toHaveTextContent('0勝1負');
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(screen.getByRole('region', { name: '各場對戰（2 場）' })).toBeInTheDocument();
  });

  it('no squad filter for a single-squad event', async () => {
    eventSheets.mockResolvedValue(TWO_OPPONENTS);
    renderPage();
    await screen.findByRole('region', { name: '賽事戰績' });
    expect(screen.queryByRole('group', { name: '隊別' })).not.toBeInTheDocument();
  });

  it('empty state when the event has no sheets', async () => {
    eventSheets.mockResolvedValue(response([]));
    renderPage();
    expect(await screen.findByText('尚無記錄單')).toBeInTheDocument();
  });

  it('load error offers retry', async () => {
    eventSheets.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(TWO_OPPONENTS);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '重試' }));
    expect(await screen.findByRole('region', { name: '賽事戰績' })).toBeInTheDocument();
  });
});
