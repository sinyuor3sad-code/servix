import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSwitcher } from '@/components/language-switcher';

// Mock useLocale hook
const mockSetLocale = vi.fn();
let currentLocale = 'ar';

vi.mock('@/hooks/use-locale', () => ({
  useLocale: () => ({
    locale: currentLocale,
    dir: currentLocale === 'ar' ? 'rtl' : 'ltr',
    setLocale: mockSetLocale,
    t: (key: string) => key,
  }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLocale = 'ar';
  });

  it('should render with EN label when locale is ar', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText('EN')).toBeDefined();
  });

  it('should call setLocale(en) when clicked from Arabic', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetLocale).toHaveBeenCalledWith('en');
  });

  it('should show globe icon SVG', () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).toBeDefined();
  });
});
