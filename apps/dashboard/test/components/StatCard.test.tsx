import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/ui/stat-card';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  TrendingUp: () => <svg data-testid="trending-up" />,
  TrendingDown: () => <svg data-testid="trending-down" />,
}));

// Mock count-up (it uses requestAnimationFrame)
vi.mock('@/components/ui/count-up', () => ({
  CountUp: ({ value }: { value: number }) => <span>{value}</span>,
}));

describe('StatCard', () => {
  it('should render label and string value', () => {
    render(<StatCard label="العملاء" value="42" />);
    expect(screen.getByText('العملاء')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
  });

  it('should render numeric value', () => {
    render(<StatCard label="الإيرادات" value={1500} />);
    expect(screen.getByText('1500')).toBeDefined();
  });

  it('should handle zero value', () => {
    render(<StatCard label="المواعيد" value={0} />);
    expect(screen.getByText('0')).toBeDefined();
  });

  it('should render trend up indicator', () => {
    render(
      <StatCard
        label="الإيرادات"
        value="1500"
        trend={{ value: 12, direction: 'up' }}
      />,
    );
    expect(screen.getByText('12%')).toBeDefined();
    expect(screen.getByTestId('trending-up')).toBeDefined();
  });

  it('should render trend down indicator', () => {
    render(
      <StatCard
        label="الإيرادات"
        value="800"
        trend={{ value: 5, direction: 'down' }}
      />,
    );
    expect(screen.getByText('5%')).toBeDefined();
    expect(screen.getByTestId('trending-down')).toBeDefined();
  });

  it('should render without trend', () => {
    const { container } = render(<StatCard label="العملاء" value="10" />);
    expect(container.querySelector('[data-testid="trending-up"]')).toBeNull();
    expect(container.querySelector('[data-testid="trending-down"]')).toBeNull();
  });
});
