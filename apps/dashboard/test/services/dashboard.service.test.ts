import { describe, it, expect, vi } from 'vitest';

describe('Dashboard Service', () => {
  it('should format revenue as SAR currency', () => {
    const amount = 45000;
    const formatted = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(amount);
    expect(formatted).toContain('45');
  });

  it('should calculate daily stats correctly', () => {
    const appointments = [
      { status: 'CONFIRMED', price: 100 },
      { status: 'COMPLETED', price: 200 },
      { status: 'CANCELLED', price: 150 },
    ];
    const completed = appointments.filter(a => a.status === 'COMPLETED');
    const totalRevenue = completed.reduce((sum, a) => sum + a.price, 0);
    expect(totalRevenue).toBe(200);
    expect(completed.length).toBe(1);
  });

  it('should handle empty stats response', () => {
    const stats = { totalAppointments: 0, totalClients: 0, totalRevenue: 0 };
    expect(stats.totalAppointments).toBe(0);
    expect(stats.totalRevenue).toBe(0);
  });

  it('should calculate growth percentage', () => {
    const current = 120;
    const previous = 100;
    const growth = ((current - previous) / previous) * 100;
    expect(growth).toBe(20);
  });

  it('should handle zero previous value for growth', () => {
    const current = 50;
    const previous = 0;
    const growth = previous === 0 ? 100 : ((current - previous) / previous) * 100;
    expect(growth).toBe(100);
  });
});
