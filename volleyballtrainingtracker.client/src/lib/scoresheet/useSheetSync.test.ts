import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scoreSheetsApi, type MatchScoreSheetDto } from '@/api/scoreSheets';
import { emptyContent, pushRally } from './sheet';
import { clearSheetDraft, readSheetDraft, useSheetSync } from './useSheetSync';

vi.mock('@/api/scoreSheets', async (orig) => {
  const actual = await orig<typeof import('@/api/scoreSheets')>();
  return { ...actual, scoreSheetsApi: { list: vi.fn(), save: vi.fn(), remove: vi.fn() } };
});

const save = vi.mocked(scoreSheetsApi.save);
const list = vi.mocked(scoreSheetsApi.list);
const KEY = 'scoresheet:7:1';

const dto = (version: number, rally: string[] = []): MatchScoreSheetDto => ({
  setIndex: 1,
  recorderName: '小明',
  content: { ...emptyContent(), rally },
  version,
  updatedAt: '2026-11-05T00:00:00Z',
  updatedByName: 'x',
});

const conflict409 = (version: number) => ({
  response: { status: 409, data: { message: 'conflict', version, updatedAt: null, updatedByName: '他人' } },
});

const mount = (server: MatchScoreSheetDto | null = dto(2)) =>
  renderHook(() => useSheetSync({ matchLogId: 7, setIndex: 1, server }));

/** 讓已 resolve 的 promise 回呼跑完 */
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  save.mockReset();
  list.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSheetSync', () => {
  it('debounces uploads to 1000ms', async () => {
    save.mockResolvedValue(dto(3));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    act(() => result.current.update((c) => pushRally(c, 'O')));
    act(() => result.current.update((c) => pushRally(c, 'TU')));
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(save).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][2].content.rally).toEqual(['U', 'O', 'TU']);
    expect(save.mock.calls[0][2].expectedVersion).toBe(2);
    expect(result.current.status).toBe('saved');
  });

  it('writes draft to localStorage immediately', () => {
    save.mockResolvedValue(dto(3));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    const d = JSON.parse(localStorage.getItem(KEY)!);
    expect(d.dirty).toBe(true);
    expect(d.content.rally).toEqual(['U']);
    expect(d.baseVersion).toBe(2);
    expect(result.current.status).toBe('pending');
  });

  it('prefers newer local draft over server on load', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      content: { ...emptyContent(), rally: ['O'] }, recorderName: '本機', baseVersion: 1, dirty: true, savedAt: 1,
    }));
    save.mockResolvedValue(dto(2));
    const { result } = mount(dto(5));
    expect(result.current.content.rally).toEqual(['O']);
    expect(result.current.recorderName).toBe('本機');
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][2].expectedVersion).toBe(1);
  });

  it('uses server content when draft is not dirty or missing', () => {
    localStorage.setItem(KEY, JSON.stringify({ content: emptyContent(), recorderName: null, baseVersion: 1, dirty: false, savedAt: 1 }));
    const { result } = mount(dto(2, ['U']));
    expect(result.current.content.rally).toEqual(['U']);
    expect(result.current.status).toBe('saved');
  });

  it('works in memory when localStorage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    save.mockResolvedValue(dto(3));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
    spy.mockRestore();
    get.mockRestore();
  });

  it('goes offline on network error and retries', async () => {
    save.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(dto(3));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.status).toBe('offline');
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
    expect(JSON.parse(localStorage.getItem(KEY)!).dirty).toBe(false);
  });

  it('treats 5xx as offline and retries on online event', async () => {
    save.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce(dto(3));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.status).toBe('offline');
    await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('conflict stops retrying', async () => {
    save.mockRejectedValue(conflict409(4));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.status).toBe('conflict');
    expect(result.current.conflict).toEqual({ version: 4, updatedByName: '他人' });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('overwrite after conflict resends with server version', async () => {
    save.mockRejectedValueOnce(conflict409(4)).mockResolvedValueOnce(dto(5));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => { void result.current.resolveConflict('mine'); });
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][2].expectedVersion).toBe(4);
    expect(save.mock.calls[1][2].content.rally).toEqual(['U']);
    expect(result.current.status).toBe('saved');
    expect(result.current.conflict).toBeNull();
  });

  it('use server after conflict replaces content and clears draft', async () => {
    save.mockRejectedValueOnce(conflict409(4));
    list.mockResolvedValue({
      matchLogId: 7, matchEventId: 1, opponent: 'A', matchDate: '2026-11-05', matchType: null, ourSquad: null,
      roster: [], sheets: [dto(4, ['O', 'O'])],
    });
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => { void result.current.resolveConflict('server'); });
    await flush();
    expect(result.current.content.rally).toEqual(['O', 'O']);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(result.current.status).toBe('saved');
    expect(result.current.conflict).toBeNull();
  });

  it("'server' fetch failure resolves false and keeps conflict", async () => {
    save.mockRejectedValueOnce(conflict409(4));
    list.mockRejectedValue(new Error('network'));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.resolveConflict('server'); });
    expect(ok).toBe(false);
    expect(result.current.conflict).not.toBeNull();
    expect(result.current.status).toBe('conflict');
    expect(result.current.content.rally).toEqual(['U']);
  });

  it("'server' success resolves true", async () => {
    save.mockRejectedValueOnce(conflict409(4));
    list.mockResolvedValue({
      matchLogId: 7, matchEventId: 1, opponent: 'A', matchDate: '2026-11-05', matchType: null, ourSquad: null,
      roster: [], sheets: [dto(4, ['O'])],
    });
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.resolveConflict('server'); });
    expect(ok).toBe(true);
    expect(result.current.conflict).toBeNull();
  });

  it("'mine' resolves true and persists the new baseVersion to localStorage", async () => {
    save.mockRejectedValueOnce(conflict409(6)).mockReturnValueOnce(new Promise(() => {}));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.resolveConflict('mine'); });
    expect(ok).toBe(true);
    const draft = JSON.parse(localStorage.getItem(KEY)!);
    expect(draft.baseVersion).toBe(6);
    expect(draft.dirty).toBe(true);
  });

  it('readSheetDraft returns the stored draft or null', () => {
    save.mockResolvedValue(dto(3));
    expect(readSheetDraft(7, 1)).toBeNull();
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'O')));
    const d = readSheetDraft(7, 1);
    expect(d?.content.rally).toEqual(['O']);
    expect(d?.baseVersion).toBe(2);
    expect(readSheetDraft(7, 2)).toBeNull();
  });

  it('never runs two uploads concurrently; resends latest after in-flight save', async () => {
    let resolveFirst!: (v: MatchScoreSheetDto) => void;
    save.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; })).mockResolvedValueOnce(dto(4));
    const { result } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(save).toHaveBeenCalledTimes(1);
    act(() => result.current.update((c) => pushRally(c, 'O')));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { resolveFirst(dto(3)); await vi.advanceTimersByTimeAsync(0); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][2].expectedVersion).toBe(3);
    expect(save.mock.calls[1][2].content.rally).toEqual(['U', 'O']);
    expect(result.current.status).toBe('saved');
  });

  it('flushes pending upload on unmount', () => {
    save.mockResolvedValue(dto(3));
    const { result, unmount } = mount();
    act(() => result.current.update((c) => pushRally(c, 'U')));
    expect(save).not.toHaveBeenCalled();
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('clearSheetDraft removes the stored draft', () => {
    localStorage.setItem(KEY, JSON.stringify({ dirty: true, content: emptyContent() }));
    expect(readSheetDraft(7, 1)).not.toBeNull();
    clearSheetDraft(7, 1);
    expect(readSheetDraft(7, 1)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
