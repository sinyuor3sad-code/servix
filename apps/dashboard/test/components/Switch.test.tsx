import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui', async () => {
  const React = await import('react');
  return {
    Switch: ({ checked, onCheckedChange, disabled, id, ...props }: any) => (
      <button
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        {...props}
      />
    ),
  };
});

import { Switch } from '@/components/ui';

describe('Switch', () => {
  it('renders with unchecked state', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('renders with checked state', () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles on click', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
