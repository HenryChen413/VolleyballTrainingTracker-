import { describe, it, expect } from 'vitest';
import {
  parsePositions,
  primaryPosition,
  groupByPrimaryPosition,
  POSITION_LABELS,
  OTHER_KEY,
} from './positions';

describe('parsePositions', () => {
  it('空值回傳空陣列', () => {
    expect(parsePositions(null)).toEqual([]);
    expect(parsePositions(undefined)).toEqual([]);
    expect(parsePositions('')).toEqual([]);
  });

  it('以逗號拆分並去除空白', () => {
    expect(parsePositions('OH, MB')).toEqual(['OH', 'MB']);
    expect(parsePositions(' S ,L')).toEqual(['S', 'L']);
  });

  it('過濾掉空白片段', () => {
    expect(parsePositions('OH,,MB,')).toEqual(['OH', 'MB']);
  });
});

describe('primaryPosition', () => {
  it('取第一個有效位置', () => {
    expect(primaryPosition('MB,OH')).toBe('MB');
  });

  it('無位置時回傳 null', () => {
    expect(primaryPosition('')).toBeNull();
    expect(primaryPosition(null)).toBeNull();
  });
});

describe('groupByPrimaryPosition', () => {
  type P = { name: string; pos: string | null };
  const players: P[] = [
    { name: '甲', pos: 'OH' },
    { name: '乙', pos: 'S,OH' },
    { name: '丙', pos: 'MB' },
    { name: '丁', pos: null },
  ];

  it('依固定順序分組（S → OH → OPP → MB → L → 其他）', () => {
    const groups = groupByPrimaryPosition(players, (p) => p.pos);
    expect(groups.map((g) => g.key)).toEqual(['S', 'OH', 'MB', OTHER_KEY]);
  });

  it('未分類球員歸入「其他」群組', () => {
    const groups = groupByPrimaryPosition(players, (p) => p.pos);
    const other = groups.find((g) => g.key === OTHER_KEY);
    expect(other?.items.map((p) => p.name)).toEqual(['丁']);
  });

  it('空群組會被過濾掉（無自由球員時不出現 L）', () => {
    const groups = groupByPrimaryPosition(players, (p) => p.pos);
    expect(groups.some((g) => g.key === 'L')).toBe(false);
  });

  it('群組標籤使用中文位置名稱', () => {
    const groups = groupByPrimaryPosition(players, (p) => p.pos);
    expect(groups.find((g) => g.key === 'MB')?.label).toBe(POSITION_LABELS.MB);
  });
});
