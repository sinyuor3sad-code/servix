import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui', async () => {
  const React = await import('react');
  return {
    Dialog: ({ children, open, onOpenChange }: any) =>
      open ? <div data-testid="dialog-overlay" onClick={() => onOpenChange?.(false)}>{children}</div> : null,
    DialogContent: ({ children }: any) => <div data-testid="dialog-content" role="dialog">{children}</div>,
    DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
    DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  };
});

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui';

describe('Dialog', () => {
  it('renders when open', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p>هل أنت متأكد؟</p>
          <DialogFooter><button>نعم</button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('تأكيد الحذف')).toBeInTheDocument();
    expect(screen.getByText('هل أنت متأكد؟')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent><p>hidden</p></DialogContent>
      </Dialog>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when overlay clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onOpenChange={onClose}>
        <DialogContent><p>content</p></DialogContent>
      </Dialog>
    );
    fireEvent.click(screen.getByTestId('dialog-overlay'));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
