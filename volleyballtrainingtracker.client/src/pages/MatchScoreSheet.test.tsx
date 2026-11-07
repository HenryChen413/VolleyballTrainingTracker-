// 單局比賽記錄單頁：記分、撤銷、加入隊員、局號檢查、衝突處理
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  scoreSheetsApi,
  type MatchScoreSheetDto,
  type MatchScoreSheetsResponse,
} from '@/api/scoreSheets';
import { resetSheetSyncForTests } from '@/lib/scoresheet/useSheetSync';
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
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/match-logs/:eventId/games/:matchLogId/sheets/:setIndex" element={<MatchScoreSheetPage />} />
          <Route path="/match-logs/:eventId/games/:matchLogId/sheets" element={<div>記錄單列表</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const CACHE_KEY = 'scoresheet-list:7';
const conflictErr = (version: number) => ({
  response: { status: 409, data: { message: 'x', version, updatedAt: null, updatedByName: '別人' } },
});

const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const tap = (el: HTMLElement) => {
  fireEvent.pointerDown(el);
  fireEvent.pointerUp(el);
};
const headerScore = () => screen.getByRole('status', { name: '目前比分' });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resetSheetSyncForTests();
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

  it('substitution: 換人 → 下場 → 上場 marks strip and row, auto-adds the player', async () => {
    const withLineup = sheet(1, {
      lineup: [1, null, null, null, null, null],
      rows: [{ playerId: 1, name: '小美', jerseyNo: 12, counts: {} }],
      oppErrors: 0,
      ourErrors: 0,
      rally: ['U'],
    });
    list.mockResolvedValue(response([withLineup]));
    renderAt('/match-logs/3/games/7/sheets/1');
    await screen.findByText('VS 某某大學');
    fireEvent.click(btn('換人'));
    fireEvent.click(within(screen.getByRole('group', { name: '下場' })).getByRole('button', { name: '12 小美' }));
    fireEvent.click(within(screen.getByRole('group', { name: '上場' })).getByRole('button', { name: '5 小芳' }));
    expect(screen.getByTitle('換人：12 下、5 上')).toHaveTextContent('12→5');
    const fang = screen.getAllByRole('rowheader').find((th) => th.textContent?.includes('小芳'))!;
    expect(within(fang).getByText('替12')).toBeInTheDocument();
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
  it('conflict: failed server fetch re-enables both choices and shows a toast', async () => {
    const { showError } = await import('@/lib/swal');
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
      list.mockRejectedValue(new Error('network'));
      fireEvent.click(within(dialog).getByRole('button', { name: '改用伺服器版本' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(within(dialog).getByRole('button', { name: '改用伺服器版本' })).toBeEnabled();
      expect(within(dialog).getByRole('button', { name: '用我的覆蓋' })).toBeEnabled();
      expect(showError).toHaveBeenCalledWith('無法取得伺服器版本，請檢查網路後再試');
    } finally {
      vi.useRealTimers();
    }
  });

  it('list fails + local draft exists → can continue with the draft', async () => {
    localStorage.setItem('scoresheet:7:2', JSON.stringify({
      content: {
        lineup: [null, null, null, null, null, null],
        rows: [{ playerId: 1, name: '小美', jerseyNo: 12, counts: { serveO: 3 } }],
        oppErrors: 0, ourErrors: 0, rally: ['U', 'U', 'O'],
      },
      recorderName: '草稿人', baseVersion: 4, dirty: true, savedAt: 1,
    }));
    list.mockRejectedValue(new Error('network'));
    renderAt('/match-logs/3/games/7/sheets/2');
    fireEvent.click(await screen.findByRole('button', { name: '以本機草稿繼續' }));
    expect(await screen.findByText('VS —')).toBeInTheDocument();
    expect(screen.getByText('第 2 局')).toBeInTheDocument();
    expect(headerScore()).toHaveTextContent('2 : 1');
    expect(btn('小美 發球 O')).toHaveTextContent('3');
    expect(screen.getByLabelText('記錄人')).toHaveValue('草稿人');
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][2].expectedVersion).toBe(4);
  });

  it('list fails + no local draft → no draft button, only retry', async () => {
    list.mockRejectedValue(new Error('network'));
    renderAt('/match-logs/3/games/7/sheets/2');
    expect(await screen.findByText('無法載入記錄單，請確認網路後重試')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '以本機草稿繼續' })).not.toBeInTheDocument();
    expect(btn('重試')).toBeInTheDocument();
  });

  it('slow load (8s) + local draft exists → draft button appears while loading', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('scoresheet:7:1', JSON.stringify({
        content: { rally: ['U'] }, recorderName: null, baseVersion: 1, dirty: false, savedAt: 1,
      }));
      list.mockReturnValue(new Promise(() => {}));
      renderAt('/match-logs/3/games/7/sheets/1');
      await act(async () => { await vi.advanceTimersByTimeAsync(7999); });
      expect(screen.queryByRole('button', { name: '以本機草稿繼續' })).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      fireEvent.click(btn('以本機草稿繼續'));
      expect(headerScore()).toHaveTextContent('1 : 0');
    } finally {
      vi.useRealTimers();
    }
  });

  // ── F4：離線時使用快取的對手、名單與各局 ──
  it('successful load writes the list cache', async () => {
    list.mockResolvedValue(response([SET1]));
    renderAt('/match-logs/3/games/7/sheets/1');
    await screen.findByText('VS 某某大學');
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!).roster).toHaveLength(3);
  });

  it('offline with cache: a brand-new next set can be started, roster available', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response([SET1])));
    list.mockRejectedValue(new Error('network'));
    save.mockRejectedValue(new Error('Network Error'));
    renderAt('/match-logs/3/games/7/sheets/2');
    fireEvent.click(await screen.findByRole('button', { name: '離線繼續' }));
    expect(await screen.findByText('VS 某某大學')).toBeInTheDocument();
    expect(screen.getByText('第 2 局')).toBeInTheDocument();
    fireEvent.click(btn('＋隊員'));
    const dialog = await screen.findByRole('dialog', { name: '加入隊員' });
    fireEvent.click(within(dialog).getByRole('button', { name: /小華/ }));
    expect(screen.getByRole('button', { name: '小華 發球 O', hidden: true })).toBeInTheDocument();
    await waitFor(() => expect(save).toHaveBeenCalled(), { timeout: 3000 });
    expect(save.mock.calls[0][1]).toBe(2);
    expect(save.mock.calls[0][2].expectedVersion).toBe(0);
  });

  it('offline with cache: existing set opens with cached content and roster', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response([sheet(1, { rally: ['U', 'O', 'O'] }, 3)])));
    list.mockRejectedValue(new Error('network'));
    renderAt('/match-logs/3/games/7/sheets/1');
    fireEvent.click(await screen.findByRole('button', { name: '離線繼續' }));
    expect(await screen.findByText('VS 某某大學')).toBeInTheDocument();
    expect(headerScore()).toHaveTextContent('1 : 2');
    fireEvent.click(btn('＋隊員'));
    const dialog = await screen.findByRole('dialog', { name: '加入隊員' });
    expect(within(dialog).getByRole('button', { name: /小美/ })).toBeInTheDocument();
  });

  it('offline with draft: roster still comes from the cache', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response([SET1])));
    localStorage.setItem('scoresheet:7:2', JSON.stringify({
      content: { rally: ['U'] }, recorderName: '草稿人', baseVersion: 0, dirty: true, savedAt: 1,
    }));
    list.mockRejectedValue(new Error('network'));
    renderAt('/match-logs/3/games/7/sheets/2');
    fireEvent.click(await screen.findByRole('button', { name: '以本機草稿繼續' }));
    expect(await screen.findByText('VS 某某大學')).toBeInTheDocument();
    expect(headerScore()).toHaveTextContent('1 : 0');
    fireEvent.click(btn('＋隊員'));
    const dialog = await screen.findByRole('dialog', { name: '加入隊員' });
    expect(within(dialog).getByRole('button', { name: /小芳/ })).toBeInTheDocument();
  });

  it('offline: next set after a draft-only set can be started', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response([SET1])));
    localStorage.setItem('scoresheet:7:2', JSON.stringify({
      content: { rally: ['U'] }, recorderName: null, baseVersion: 0, dirty: true, savedAt: 1,
    }));
    list.mockRejectedValue(new Error('network'));
    renderAt('/match-logs/3/games/7/sheets/3');
    fireEvent.click(await screen.findByRole('button', { name: '離線繼續' }));
    expect(await screen.findByText('第 3 局')).toBeInTheDocument();
  });

  it('offline: a set beyond the next one is redirected to the list', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(response([SET1])));
    list.mockRejectedValue(new Error('network'));
    renderAt('/match-logs/3/games/7/sheets/3');
    fireEvent.click(await screen.findByRole('button', { name: '離線繼續' }));
    expect(await screen.findByText('記錄單列表')).toBeInTheDocument();
  });

  // ── F5：伺服器上此局已被刪除 ──
  it('conflict with version 0 offers re-create or discard; re-create sends expectedVersion 0', async () => {
    vi.useFakeTimers();
    try {
      list.mockResolvedValue(response([SET1]));
      save.mockRejectedValueOnce(conflictErr(0));
      renderAt('/match-logs/3/games/7/sheets/1');
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(btn('我方 +1'));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      const dialog = screen.getByRole('dialog', { name: '版本衝突' });
      expect(within(dialog).getByText('伺服器上此局已被刪除')).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: '用我的覆蓋' })).not.toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: '用我的重新建立' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][2].expectedVersion).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('conflict with version 0: discard clears the draft and returns to the list', async () => {
    vi.useFakeTimers();
    try {
      list.mockResolvedValue(response([SET1]));
      save.mockRejectedValueOnce(conflictErr(0));
      renderAt('/match-logs/3/games/7/sheets/1');
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(btn('我方 +1'));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      const dialog = screen.getByRole('dialog', { name: '版本衝突' });
      fireEvent.click(within(dialog).getByRole('button', { name: '捨棄本機版本' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByText('記錄單列表')).toBeInTheDocument();
      expect(localStorage.getItem('scoresheet:7:1')).toBeNull();
      expect(save).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // ── F6：伺服器拒絕時顯示無法同步與重試 ──
  it('permanent 4xx shows the error with a retry action', async () => {
    vi.useFakeTimers();
    try {
      list.mockResolvedValue(response([SET1]));
      save.mockRejectedValueOnce({ response: { status: 400, data: { message: '局號不正確' } } });
      renderAt('/match-logs/3/games/7/sheets/1');
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(btn('我方 +1'));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(screen.getByRole('status', { name: '同步狀態' })).toHaveTextContent('無法同步（局號不正確）');
      await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
      expect(save).toHaveBeenCalledTimes(1);
      fireEvent.click(btn('重試同步'));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(save).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('status', { name: '同步狀態' })).toHaveTextContent('已同步');
    } finally {
      vi.useRealTimers();
    }
  });
});
