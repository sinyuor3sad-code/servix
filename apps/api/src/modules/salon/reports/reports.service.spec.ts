import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const mockDb: any = {
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
    },
    client: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    employee: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
    appointmentService: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService();
  });

  describe('getDashboard', () => {
    it('should return dashboard metrics', async () => {
      mockDb.appointment.count
        .mockResolvedValueOnce(5)   // todayAppointments
        .mockResolvedValueOnce(15); // monthlyAppointments
      mockDb.invoice.findMany
        .mockResolvedValueOnce([{ total: 100 }, { total: 250 }])  // todayInvoices
        .mockResolvedValueOnce([{ total: 100 }, { total: 250 }, { total: 500 }]); // monthInvoices
      mockDb.client.count.mockResolvedValue(42);
      mockDb.employee.count.mockResolvedValue(8);
      mockDb.appointment.findMany.mockResolvedValue([]);

      const result = await service.getDashboard(mockDb);

      expect(result.todayAppointments).toBe(5);
      expect(result.todayRevenue).toBe(350);
      expect(result.monthRevenue).toBe(850);
      expect(result.totalClients).toBe(42);
      expect(result.totalEmployees).toBe(8);
      expect(result.monthlyAppointments).toBe(15);
    });

    it('should handle empty data', async () => {
      mockDb.appointment.count.mockResolvedValue(0);
      mockDb.invoice.findMany.mockResolvedValue([]);
      mockDb.client.count.mockResolvedValue(0);
      mockDb.employee.count.mockResolvedValue(0);
      mockDb.appointment.findMany.mockResolvedValue([]);

      const result = await service.getDashboard(mockDb);

      expect(result.todayAppointments).toBe(0);
      expect(result.todayRevenue).toBe(0);
      expect(result.totalClients).toBe(0);
    });
  });

  describe('getRevenue', () => {
    it('should group invoices by day', async () => {
      const paidAt = new Date('2024-01-15');
      mockDb.invoice.findMany.mockResolvedValue([
        { total: 100, paidAt },
        { total: 200, paidAt },
      ]);

      const result = await service.getRevenue(mockDb, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        groupBy: 'day',
      });

      expect(result.totalRevenue).toBe(300);
      expect(result.totalCount).toBe(2);
      expect(result.items).toHaveLength(1);
    });

    it('should handle no invoices', async () => {
      mockDb.invoice.findMany.mockResolvedValue([]);

      const result = await service.getRevenue(mockDb, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(result.totalRevenue).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getAppointments', () => {
    it('should count by status and source', async () => {
      mockDb.appointment.findMany.mockResolvedValue([
        { status: 'completed', source: 'online' },
        { status: 'completed', source: 'walkin' },
        { status: 'cancelled', source: 'online' },
      ]);

      const result = await service.getAppointments(mockDb, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(result.total).toBe(3);
      expect(result.byStatus.completed).toBe(2);
      expect(result.byStatus.cancelled).toBe(1);
      expect(result.bySource.online).toBe(2);
    });
  });

  describe('getClients', () => {
    it('should return new and returning client counts', async () => {
      mockDb.client.count
        .mockResolvedValueOnce(10)  // newClients
        .mockResolvedValueOnce(5);  // returningClients
      mockDb.client.findMany.mockResolvedValue([
        { id: '1', fullName: 'سارة', phone: '0512345', totalVisits: 10, totalSpent: 500 },
      ]);

      const result = await service.getClients(mockDb, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(result.newClients).toBe(10);
      expect(result.returningClients).toBe(5);
      expect(result.topClients).toHaveLength(1);
    });
  });

  describe('getEmployees', () => {
    it('should return employee performance sorted by revenue', async () => {
      mockDb.employee.findMany.mockResolvedValue([
        { id: 'e1', fullName: 'نورة', role: 'stylist' },
        { id: 'e2', fullName: 'سارة', role: 'stylist' },
      ]);
      mockDb.appointment.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);
      mockDb.appointmentService.findMany
        .mockResolvedValueOnce([{ price: 100 }, { price: 150 }])
        .mockResolvedValueOnce([{ price: 500 }]);

      const result = await service.getEmployees(mockDb, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(result).toHaveLength(2);
      // Sorted by revenue desc: سارة (500) > نورة (250)
      expect(result[0].revenue).toBe(500);
      expect(result[1].revenue).toBe(250);
    });
  });

  describe('getExpenses', () => {
    it('should group expenses by category', async () => {
      mockDb.expense.findMany.mockResolvedValue([
        { category: 'rent', amount: 5000 },
        { category: 'rent', amount: 5000 },
        { category: 'supplies', amount: 1000 },
      ]);

      const result = await service.getExpenses(mockDb, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(result.grandTotal).toBe(11000);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].category).toBe('rent');
      expect(result.items[0].total).toBe(10000);
    });
  });
});
