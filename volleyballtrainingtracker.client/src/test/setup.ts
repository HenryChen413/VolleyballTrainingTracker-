// Vitest 全域測試環境設定
// - 載入 jest-dom 自訂 matcher（toBeInTheDocument 等）
// - 註冊 vitest-axe 的 toHaveNoViolations matcher（型別見 vitest-axe.d.ts）
// - 每個測試後自動清理 React Testing Library 掛載的節點
import '@testing-library/jest-dom/vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(axeMatchers);

afterEach(() => {
  cleanup();
});
