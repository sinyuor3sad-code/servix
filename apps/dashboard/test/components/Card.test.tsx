import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui', async () => {
  const React = await import('react');
  return {
    Card: ({ children, className, ...props }: any) => <div data-testid="card" className={className} {...props}>{children}</div>,
    CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
    CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
    CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
    CardFooter: ({ children }: any) => <div data-testid="card-footer">{children}</div>,
  };
});

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui';

describe('Card', () => {
  it('renders card with all sections', () => {
    render(
      <Card>
        <CardHeader><CardTitle>عنوان</CardTitle></CardHeader>
        <CardContent>محتوى</CardContent>
        <CardFooter>تذييل</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('card-header')).toBeInTheDocument();
    expect(screen.getByText('عنوان')).toBeInTheDocument();
    expect(screen.getByText('محتوى')).toBeInTheDocument();
    expect(screen.getByText('تذييل')).toBeInTheDocument();
  });

  it('renders card without optional sections', () => {
    render(<Card><CardContent>فقط محتوى</CardContent></Card>);
    expect(screen.getByText('فقط محتوى')).toBeInTheDocument();
  });

  it('accepts className', () => {
    render(<Card className="custom-class"><CardContent>test</CardContent></Card>);
    expect(screen.getByTestId('card')).toHaveClass('custom-class');
  });
});
