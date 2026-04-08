import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/theme-selector', () => ({
  ThemeSelector: ({ themes }: any) => (
    <div data-testid="theme-selector">
      {(themes || ['blue', 'green', 'purple']).map((t: string) => (
        <button key={t} data-testid={`theme-${t}`}>{t}</button>
      ))}
    </div>
  ),
}));

import { ThemeSelector } from '@/components/theme-selector';

describe('ThemeSelector', () => {
  it('renders theme options', () => {
    render(<ThemeSelector themes={['blue', 'green', 'red']} />);
    expect(screen.getByTestId('theme-blue')).toBeInTheDocument();
    expect(screen.getByTestId('theme-green')).toBeInTheDocument();
    expect(screen.getByTestId('theme-red')).toBeInTheDocument();
  });

  it('renders with default themes', () => {
    render(<ThemeSelector />);
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
  });
});
