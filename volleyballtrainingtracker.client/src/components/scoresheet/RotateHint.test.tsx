import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RotateHint } from './RotateHint';

const mockMatchMedia = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

describe('RotateHint', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('portrait shows the overlay with a back link', () => {
    mockMatchMedia(true);
    render(<MemoryRouter><RotateHint backTo="/list" /></MemoryRouter>);
    expect(screen.getByText('請將裝置轉為橫向')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回列表' })).toHaveAttribute('href', '/list');
  });

  it('landscape renders nothing', () => {
    mockMatchMedia(false);
    render(<MemoryRouter><RotateHint backTo="/list" /></MemoryRouter>);
    expect(screen.queryByText('請將裝置轉為橫向')).not.toBeInTheDocument();
  });
});
