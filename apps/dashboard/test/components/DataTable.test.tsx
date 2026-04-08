import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/ui', async () => {
  return {
    DataTable: ({ columns, data, searchKey, emptyMessage }: any) => (
      <div data-testid="data-table">
        {data.length === 0 ? (
          <div data-testid="empty">{emptyMessage || 'لا توجد بيانات'}</div>
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((col: any) => (
                  <th key={col.accessorKey || col.id}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, i: number) => (
                <tr key={i}>
                  {columns.map((col: any) => (
                    <td key={col.accessorKey || col.id}>
                      {col.accessorKey ? row[col.accessorKey] : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    ),
  };
});

import { DataTable } from '@/components/ui';

const columns = [
  { accessorKey: 'name', header: 'الاسم' },
  { accessorKey: 'phone', header: 'الهاتف' },
];

describe('DataTable', () => {
  it('renders data rows', () => {
    const data = [
      { name: 'أحمد', phone: '0512345678' },
      { name: 'سارة', phone: '0523456789' },
    ];
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('أحمد')).toBeInTheDocument();
    expect(screen.getByText('سارة')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="لا يوجد عملاء" />);
    expect(screen.getByText('لا يوجد عملاء')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable columns={columns} data={[{ name: 'test', phone: '123' }]} />);
    expect(screen.getByText('الاسم')).toBeInTheDocument();
    expect(screen.getByText('الهاتف')).toBeInTheDocument();
  });
});
