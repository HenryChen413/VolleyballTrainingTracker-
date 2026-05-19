import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('合併多個 class 字串', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('忽略 falsy 值', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('後者覆蓋前者的衝突 Tailwind class', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('支援條件物件語法', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });
});
