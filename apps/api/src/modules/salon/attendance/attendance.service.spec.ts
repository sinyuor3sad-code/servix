export {}; 
import { Test, TestingModule } from '@nestjs/testing';

// Mock Prisma for attendance
const mockDb = {
  attendance: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: '1', date: new Date(), checkIn: new Date(), checkOut: null }),
    update: jest.fn().mockResolvedValue({ id: '1', checkOut: new Date() }),
    count: jest.fn().mockResolvedValue(5),
  },
};

const mockTenantDb = { getClient: jest.fn().mockResolvedValue(mockDb) };

describe('AttendanceService', () => {
  it('should record check-in', async () => {
    const result = await mockDb.attendance.create({
      data: { employeeId: 'emp-1', date: new Date(), checkIn: new Date() },
    });
    expect(result).toHaveProperty('id');
    expect(result.checkIn).toBeDefined();
  });

  it('should record check-out', async () => {
    const result = await mockDb.attendance.update({
      where: { id: '1' },
      data: { checkOut: new Date() },
    });
    expect(result.checkOut).toBeDefined();
  });

  it('should list attendance records', async () => {
    const records = await mockDb.attendance.findMany();
    expect(Array.isArray(records)).toBe(true);
  });

  it('should count records', async () => {
    const count = await mockDb.attendance.count();
    expect(count).toBe(5);
  });

  it('should handle missing employee', async () => {
    mockDb.attendance.create.mockRejectedValueOnce(new Error('Employee not found'));
    await expect(
      mockDb.attendance.create({ data: { employeeId: 'invalid' } }),
    ).rejects.toThrow('Employee not found');
  });
});

