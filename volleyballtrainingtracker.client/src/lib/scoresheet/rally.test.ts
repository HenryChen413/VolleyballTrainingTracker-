import { describe, expect, it } from 'vitest';
import { layoutRally, scoreOf } from './rally';

describe('rally', () => {
  it('layouts staggered running score', () => {
    const cells = layoutRally(['U', 'U', 'U', 'O', 'O', 'U', 'O']);
    expect(cells.map((c) => c.our)).toEqual(['1', '2', '3', '', '', '4', '']);
    expect(cells.map((c) => c.opp)).toEqual(['', '', '', '1', '2', '', '3']);
  });

  it('timeout occupies its own column', () => {
    expect(layoutRally(['U', 'TO', 'O'])).toEqual([
      { our: '1', opp: '', timeout: null },
      { our: '', opp: '', timeout: 'O' },
      { our: '', opp: '1', timeout: null },
    ]);
  });

  it('score of timeouts-only rally is 0:0', () => {
    expect(scoreOf(['TU', 'TO'])).toEqual({ our: 0, opp: 0 });
    expect(scoreOf(['U', 'O', 'U'])).toEqual({ our: 2, opp: 1 });
  });
});
