// vitest-axe 的型別擴充。
// 套件內建的 extend-expect.d.ts 仍以舊版 `Vi.Assertion` 命名空間宣告，
// 不相容 Vitest 4，故在此改以擴充 `vitest` 模組的方式註冊 toHaveNoViolations。
import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
  // 型別參數 T 必須保留以與 Vitest 的 Assertion<T> 宣告合併
  /* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
  interface Assertion<T = unknown> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
}
