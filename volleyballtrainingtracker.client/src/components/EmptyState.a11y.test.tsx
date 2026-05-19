import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import EmptyState from './EmptyState';
import { Button } from './ui/button';

describe('EmptyState 無障礙', () => {
  it('預設狀態無 axe 可偵測的無障礙問題', async () => {
    const { container } = render(<EmptyState />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('帶標題、說明與動作按鈕時無無障礙問題', async () => {
    const { container } = render(
      <EmptyState
        title="尚無球員"
        description="點下方按鈕新增第一位球員"
        action={<Button>新增球員</Button>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
