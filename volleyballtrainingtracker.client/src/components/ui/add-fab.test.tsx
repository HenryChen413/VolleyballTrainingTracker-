import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { AddFab } from './add-fab';

/** jsdom 的 window.scrollY 是唯讀 getter，需用 defineProperty 覆寫。 */
function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
}

/** 捲到指定位置並等一幀，讓元件的 rAF 節流跑完。 */
async function scrollTo(y: number) {
  setScrollY(y);
  await act(async () => {
    fireEvent.scroll(window);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

const fab = () => screen.getByRole('button', { name: '新增球員' });

describe('AddFab 捲動收合', () => {
  beforeEach(() => {
    setScrollY(0);
  });

  it('初始為展開狀態，顯示完整文字', () => {
    render(<AddFab label="新增球員" onClick={vi.fn()} />);
    expect(fab()).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText('新增球員')).toBeInTheDocument();
  });

  it('向下捲動時收合', async () => {
    render(<AddFab label="新增球員" onClick={vi.fn()} />);
    await scrollTo(200);
    expect(fab()).toHaveAttribute('data-collapsed', 'true');
  });

  it('向上捲動時重新展開', async () => {
    render(<AddFab label="新增球員" onClick={vi.fn()} />);
    await scrollTo(200);
    expect(fab()).toHaveAttribute('data-collapsed', 'true');

    await scrollTo(120);
    expect(fab()).toHaveAttribute('data-collapsed', 'false');
  });

  it('停止捲動不會自動展開（避免使用者停下要點卡片時按鈕又長回來）', async () => {
    render(<AddFab label="新增球員" onClick={vi.fn()} />);
    await scrollTo(200);

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    });
    expect(fab()).toHaveAttribute('data-collapsed', 'true');
  });

  it('小於門檻的細微捲動不觸發收合', async () => {
    render(<AddFab label="新增球員" onClick={vi.fn()} />);
    await scrollTo(4);
    expect(fab()).toHaveAttribute('data-collapsed', 'false');
  });

  it('捲回頁面最頂端時展開', async () => {
    render(<AddFab label="新增球員" onClick={vi.fn()} />);
    await scrollTo(200);
    await scrollTo(0);
    expect(fab()).toHaveAttribute('data-collapsed', 'false');
  });

  it('收合後仍可用完整文字取得按鈕（無障礙名稱不變）並可點擊', async () => {
    const onClick = vi.fn();
    render(<AddFab label="新增球員" onClick={onClick} />);
    await scrollTo(200);

    const button = screen.getByRole('button', { name: '新增球員' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('卸載後移除捲動監聽', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<AddFab label="新增球員" onClick={vi.fn()} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('展開與收合狀態皆無 axe 可偵測的無障礙問題', async () => {
    const { container } = render(<AddFab label="新增球員" onClick={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();

    await scrollTo(200);
    expect(await axe(container)).toHaveNoViolations();
  });
});
