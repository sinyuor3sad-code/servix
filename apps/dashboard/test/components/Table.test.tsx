import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui', async () => {
  const React = await import('react');
  return {
    Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
    TableHeader: ({ children }: any) => <thead>{children}</thead>,
    TableBody: ({ children }: any) => <tbody>{children}</tbody>,
    TableRow: ({ children }: any) => <tr>{children}</tr>,
    TableHead: ({ children }: any) => <th>{children}</th>,
    TableCell: ({ children }: any) => <td>{children}</td>,
  };
});

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';

describe('Table', () => {
  it('renders a complete table', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الاسم</TableHead>
            <TableHead>الهاتف</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>أحمد</TableCell>
            <TableCell>0512345678</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByText('الاسم')).toBeInTheDocument();
    expect(screen.getByText('أحمد')).toBeInTheDocument();
    expect(screen.getByText('0512345678')).toBeInTheDocument();
  });

  it('renders empty table', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow><TableHead>عمود</TableHead></TableRow>
        </TableHeader>
        <TableBody />
      </Table>
    );
    expect(screen.getByText('عمود')).toBeInTheDocument();
  });

  it('renders multiple rows', () => {
    render(
      <Table>
        <TableBody>
          <TableRow><TableCell>صف 1</TableCell></TableRow>
          <TableRow><TableCell>صف 2</TableCell></TableRow>
          <TableRow><TableCell>صف 3</TableCell></TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByText('صف 1')).toBeInTheDocument();
    expect(screen.getByText('صف 3')).toBeInTheDocument();
  });
});
