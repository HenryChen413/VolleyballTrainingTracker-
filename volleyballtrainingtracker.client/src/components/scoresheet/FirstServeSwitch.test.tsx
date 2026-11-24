import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FirstServeSwitch } from './FirstServeSwitch';

describe('FirstServeSwitch', () => {
  it('未指定時兩邊都未選取', () => {
    render(<FirstServeSwitch value={null} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '我方' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: '對方' })).toHaveAttribute('aria-checked', 'false');
  });

  it('標示目前先發球方，點另一邊回傳該方', () => {
    const onChange = vi.fn();
    render(<FirstServeSwitch value="U" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: '我方' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '對方' }));
    expect(onChange).toHaveBeenCalledWith('O');
  });
});
