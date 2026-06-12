import { useState } from 'react';
import FlipDigit, { type FlipDirection } from './FlipDigit';

interface FlipCounterProps {
  value: number;
  /** 固定位數，不足補 0（比分 2 位、小局數 1 位） */
  digits: number;
  /** 螢幕閱讀器用的描述，例如「A 隊得分」 */
  label: string;
  className?: string;
}

/**
 * 多位數翻牌顯示。值已在 store 夾在 0..上限之間、不會迴繞，
 * 因此直接用新舊值大小判斷整組數字的翻轉方向。
 */
export default function FlipCounter({ value, digits, label, className }: FlipCounterProps) {
  const [last, setLast] = useState<{ value: number; dir: FlipDirection }>({ value, dir: 'inc' });
  if (value !== last.value) {
    setLast({ value, dir: value > last.value ? 'inc' : 'dec' });
  }

  const text = String(value).padStart(digits, '0').slice(-digits);

  return (
    <span
      role="status"
      aria-label={`${label}：${value}`}
      className={`inline-flex gap-[0.06em] font-mono font-bold ${className ?? ''}`}
    >
      {text.split('').map((ch, i) => (
        <FlipDigit key={i} char={ch} direction={last.dir} />
      ))}
    </span>
  );
}
