import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/ui/empty-state';

vi.mock('lucide-react', () => ({
  Package: () => <svg data-testid="icon" />,
}));

describe('EmptyState', () => {
  it('should render title', () => {
    render(<EmptyState title="لا توجد بيانات" />);
    expect(screen.getByText('لا توجد بيانات')).toBeDefined();
  });

  it('should render description when provided', () => {
    render(
      <EmptyState
        title="لا توجد مواعيد"
        description="أضف موعدك الأول للبدء"
      />,
    );
    expect(screen.getByText('أضف موعدك الأول للبدء')).toBeDefined();
  });

  it('should render action button when provided', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="فارغ"
        actionLabel="إضافة"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('إضافة')).toBeDefined();
  });
});
