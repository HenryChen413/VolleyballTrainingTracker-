import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RallyStrip } from './RallyStrip';

const rowOf = (label: string) => screen.getByRole('rowheader', { name: label }).closest('tr')!;
const cellTexts = (label: string) =>
  within(rowOf(label)).getAllByRole('cell').map((td) => td.textContent);

describe('RallyStrip', () => {
  it('renders staggered rows and timeout marker', () => {
    render(<RallyStrip rally={['U', 'O', 'TU']} />);
    expect(cellTexts('我方')).toEqual(['1', '', 'Ⓣ']);
    expect(cellTexts('對方')).toEqual(['', '1', '']);
    expect(screen.getAllByText('Ⓣ')).toHaveLength(1);
    expect(screen.getByTitle('我方暫停')).toBeInTheDocument();
  });

  it('opponent timeout appears in the opponent row', () => {
    render(<RallyStrip rally={['U', 'TO']} />);
    expect(cellTexts('對方')).toEqual(['', 'Ⓣ']);
    expect(screen.getByTitle('對方暫停')).toBeInTheDocument();
  });

  it('sub shows out→in in our row with a title', () => {
    const label = (id: number) => ({ 1: '7', 3: '12' })[id] ?? '?';
    render(<RallyStrip rally={['U']} subs={[{ out: 1, in: 3, at: 1 }]} labelOf={label} />);
    expect(cellTexts('我方')).toEqual(['1', '7→12']);
    expect(cellTexts('對方')).toEqual(['', '']);
    expect(screen.getByTitle('換人：7 下、12 上')).toBeInTheDocument();
  });

  it('empty rally shows a placeholder', () => {
    render(<RallyStrip rally={[]} />);
    expect(screen.getByText('尚未記分')).toBeInTheDocument();
  });
});
