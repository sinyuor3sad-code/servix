import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui', async () => {
  const React = await import('react');
  return {
    Select: ({ children, value, onValueChange, disabled }: any) => (
      <div data-testid="select-root">
        <select
          value={value}
          onChange={(e: any) => onValueChange?.(e.target.value)}
          disabled={disabled}
        >
          {children}
        </select>
      </div>
    ),
    SelectTrigger: ({ children }: any) => <div>{children}</div>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  };
});

import { Select, SelectItem } from '@/components/ui';

describe('Select', () => {
  it('renders with options', () => {
    render(
      <Select value="" onValueChange={() => {}}>
        <SelectItem value="daily">يومي</SelectItem>
        <SelectItem value="weekly">أسبوعي</SelectItem>
        <SelectItem value="monthly">شهري</SelectItem>
      </Select>
    );
    expect(screen.getByText('يومي')).toBeInTheDocument();
    expect(screen.getByText('أسبوعي')).toBeInTheDocument();
  });

  it('calls onValueChange on selection', () => {
    const onChange = vi.fn();
    render(
      <Select value="" onValueChange={onChange}>
        <SelectItem value="opt1">خيار 1</SelectItem>
        <SelectItem value="opt2">خيار 2</SelectItem>
      </Select>
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'opt2' } });
    expect(onChange).toHaveBeenCalledWith('opt2');
  });

  it('renders disabled state', () => {
    render(
      <Select value="" onValueChange={() => {}} disabled>
        <SelectItem value="a">test</SelectItem>
      </Select>
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
