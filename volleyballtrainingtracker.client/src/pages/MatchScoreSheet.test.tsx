// 單局比賽記錄單頁：記分、撤銷、加入隊員、局號檢查、衝突處理
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  scoreSheetsApi,
  type MatchScoreSheetDto,
  type MatchScoreSheetsResponse,
} from '@/api/scoreSheets';
import { useAuthStore } from '@/stores/authStore';
import MatchScoreSheetPage from './MatchScoreSheet';

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
const save = vi.mocked(scoreSheetsApi.save);

const sheet = (setIndex: number, content: unknown, version = 1): MatchScoreSheetDto => ({
  setIndex,
  recorderName: '王小明',
  content,
  version,
  updatedAt: '2026-11-05T00:00:00Z',
  updatedByName: '王小明',
});

const response = (sheets: MatchScoreSheetDto[]): MatchScoreSheetsResponse => ({
  matchLogId: 7,
  matchEventId: 3,
  opponent: '某某大學',
  matchDate: '2026-11-05',
  matchType: 'Friendly',
  ourSquad: null,
  roster: [
    { playerId: 1, name: '小美', jerseyNo: 12, position: 'OH' },
    { playerId: 2, name: '小華', jerseyNo: 3, position: 'S' },
    { playerId: 3, name: '小芳', jerseyNo: 5, position: 'L' },
  ],
  sheets,
});

const SET1 = sheet(1, {
  lineup: [null, null, null, null, null, null],
  rows: [{ playerId: 1, name: '小美', jerseyNo: 12, counts: {} }],
  oppErrors: 0,
  ourErrors: 0,
  rally: [],
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/match-logs/:eventId/games/:matchLogId/sheets/:setIndex" element={<MatchScoreSheetPage />} />
        <Route path="/match-logs/:eventId/games/:matchLogId/sheets" element={<div>記錄單列表</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const tap = (el: HTMLElement) => {
  fireEvent.pointerDown(el);
  fireEvent.pointerUp(el);
};
const headerScore = () => screen.getByRole('status', { name: '目前比分' });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  save.mockImplementation(async (_id, setIndex, body) => sheet(setIndex, body.content, body.expectedVersion + 1));
  useAuthStore.getState().setAuth('tok', new Date(Date.now() + 60_000).toISOString(), {
    id: 1, userName: 'TESTER', email: 't@example.com', roleId: 1, role: 'Admin',
    displayName: '測試員', permissions: [], allowedPages: ['match-logs'],
  });
});

describe('MatchScoreSheet 頁面', () => {
  it('shows opponent, set number and recorder', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/1');
    expect(await screen.findByText('VS 某某大學')).toBeInTheDocument();
    expect(screen.getByText('第 1 局')).toBeInTheDocument();
    expect(screen.getByLabelText('記錄人')).toHaveValue('王小明');
  });

  it('our +1 updates header score and strip', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/1');
    await screen.findByText('VS 某某大學');
    fireEvent.click(btn('我方 +1'));
    fireEvent.click(btn('我方 +1'));
    fireEvent.click(btn('對方 +1'));
    expect(headerScore()).toHaveTextContent('2 : 1');
    const ourRow = screen.getByRole('rowheader', { name: '我方' }).closest('tr')!;
    expect(within(ourRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '2', '']);
  });

  it('undo score removes last rally item', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/1');
    await screen.findByText('VS 某某大學');
    expect(btn('撤銷比分')).toBeDisabled();
    fireEvent.click(btn('我方 +1'));
    fireEvent.click(btn('對方暫停'));
    fireEvent.click(btn('撤銷比分'));
    expect(screen.queryByText('Ⓣ')).not.toBeInTheDocument();
    expect(headerScore()).toHaveTextContent('1 : 0');
    fireEvent.click(btn('撤銷比分'));
    expect(headerScore()).toHaveTextContent('0 : 0');
  });

  it('undo table reverts last stat bump', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/1');
    await screen.findByText('VS 某某大學');
    expect(btn('撤銷表格')).toBeDisabled();
    const c = btn('小美 發球 O');
    tap(c);
    tap(c);
    tap(btn('對方失誤'));
    expect(c).toHaveTextContent('2');
    // 中間記一分，撤銷表格不應連帶撤掉比分
    fireEvent.click(btn('我方 +1'));
    fireEvent.click(btn('撤銷表格'));
    expect(btn('對方失誤')).toHaveTextContent('0');
    fireEvent.click(btn('撤銷表格'));
    expect(c).toHaveTextContent('1');
    expect(headerScore()).toHaveTextContent('1 : 0');
  });

  it('add player dialog lists only roster players not yet added', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/1');
    await screen.findByText('VS 某某大學');
    fireEvent.click(btn('＋隊員'));
    const dialog = await screen.findByRole('dialog', { name: '加入隊員' });
    expect(within(dialog).queryByRole('button', { name: /小美/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /小華/ })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /小芳/ }));
    expect(within(dialog).queryByRole('button', { name: /小芳/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '小芳 發球 O', hidden: true })).toBeInTheDocument();
  });

  it('removing an empty row needs no confirmation', async () => {
    const { confirmAction } = await import('@/lib/swal');
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/1');
    await screen.findByText('VS 某某大學');
    fireEvent.click(btn('移除 小美'));
    await waitFor(() => expect(screen.queryByRole('button', { name: '小美 發球 O' })).not.toBeInTheDocument());
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it('new set pre-fills recorder with display name', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/2');
    expect(await screen.findByText('第 2 局')).toBeInTheDocument();
    expect(screen.getByLabelText('記錄人')).toHaveValue('測試員');
  });

  it('redirects to list for a set index that is neither existing nor next', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/3');
    expect(await screen.findByText('記錄單列表')).toBeInTheDocument();
  });

  it('conflict dialog disables both choices after the first click', async () => {
    vi.useFakeTimers();
    try {
      list.mockResolvedValue(response([SET1]));
      save.mockRejectedValue({
        response: { status: 409, data: { message: 'x', version: 5, updatedAt: null, updatedByName: '別人' } },
      });
      renderAt('/match-logs/3/games/7/sheets/1');
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(btn('我方 +1'));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      const dialog = screen.getByRole('dialog', { name: '版本衝突' });
      expect(within(dialog).getByText('伺服器上有較新的版本（別人）')).toBeInTheDocument();
      list.mockReturnValue(new Promise(() => {}));
      fireEvent.click(within(dialog).getByRole('button', { name: '改用伺服器版本' }));
      expect(within(dialog).getByRole('button', { name: '改用伺服器版本' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: '用我的覆蓋' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
