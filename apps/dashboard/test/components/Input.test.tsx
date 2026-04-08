import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock the input component
vi.mock('@/components/ui', async () => {
  const React = await import('react');
  return {
    Input: React.forwardRef<HTMLInputElement, any>(({ error, ...props }, ref) => (
      <div>
        <input ref={ref} {...props} />
        {error && <span>{error}</span>}
      </div>
    )),
  };
});

import { Input } from '@/components/ui';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="أدخل النص" />);
    expect(screen.getByPlaceholderText('أدخل النص')).toBeInTheDocument();
  });

  it('calls onChange handler', () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('shows error message', () => {
    render(<Input error="حقل مطلوب" />);
    expect(screen.getByText('حقل مطلوب')).toBeInTheDocument();
  });

  it('renders disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders with type password', () => {
    render(<Input type="password" placeholder="كلمة المرور" />);
    const input = screen.getByPlaceholderText('كلمة المرور');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('forwards value prop', () => {
    render(<Input value="test value" readOnly />);
    expect(screen.getByRole('textbox')).toHaveValue('test value');
  });
});
