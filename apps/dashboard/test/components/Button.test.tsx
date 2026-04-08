import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('should render children text', () => {
    render(<Button>حفظ</Button>);
    expect(screen.getByText('حفظ')).toBeDefined();
  });

  it('should call onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>إضافة</Button>);
    fireEvent.click(screen.getByText('إضافة'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>حفظ</Button>);
    const button = screen.getByText('حفظ').closest('button');
    expect(button?.disabled).toBe(true);
  });

  it('should render with outline variant', () => {
    render(<Button variant="outline">إلغاء</Button>);
    expect(screen.getByText('إلغاء')).toBeDefined();
  });

  it('should render with destructive variant', () => {
    render(<Button variant="destructive">حذف</Button>);
    expect(screen.getByText('حذف')).toBeDefined();
  });

  it('should render with different sizes', () => {
    const { container } = render(<Button size="sm">صغير</Button>);
    expect(container.firstElementChild).toBeDefined();
  });
});
