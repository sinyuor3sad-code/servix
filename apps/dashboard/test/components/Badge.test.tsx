import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('should render with default variant', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('should render with success variant', () => {
    render(<Badge variant="success">مؤكد</Badge>);
    const badge = screen.getByText('مؤكد');
    expect(badge).toBeDefined();
  });

  it('should render with destructive variant', () => {
    render(<Badge variant="destructive">ملغى</Badge>);
    expect(screen.getByText('ملغى')).toBeDefined();
  });

  it('should render with custom className', () => {
    render(<Badge className="custom-class">Test</Badge>);
    const badge = screen.getByText('Test');
    expect(badge.className).toContain('custom-class');
  });
});
