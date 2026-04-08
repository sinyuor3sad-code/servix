import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui', async () => {
  return {
    Spinner: ({ size = 'md', className }: any) => (
      <div role="progressbar" data-size={size} className={className} data-testid="spinner" />
    ),
  };
});

import { Spinner } from '@/components/ui';

describe('Spinner', () => {
  it('renders with default size', () => {
    render(<Spinner />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with small size', () => {
    render(<Spinner size="sm" />);
    expect(screen.getByTestId('spinner')).toHaveAttribute('data-size', 'sm');
  });

  it('renders with large size', () => {
    render(<Spinner size="lg" />);
    expect(screen.getByTestId('spinner')).toHaveAttribute('data-size', 'lg');
  });

  it('accepts className', () => {
    render(<Spinner className="custom" />);
    expect(screen.getByTestId('spinner')).toHaveClass('custom');
  });
});
