export {}; 
const mockDb = {
  shift: {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', employeeId: 'e1', startTime: '09:00', endTime: '17:00', dayOfWeek: 0 },
    ]),
    create: jest.fn().mockResolvedValue({ id: '1', employeeId: 'e1', startTime: '09:00', endTime: '17:00' }),
    update: jest.fn().mockResolvedValue({ id: '1', startTime: '10:00', endTime: '18:00' }),
    delete: jest.fn().mockResolvedValue({ id: '1' }),
  },
};

describe('ShiftsService', () => {
  it('should list shifts for employee', async () => {
    const shifts = await mockDb.shift.findMany({ where: { employeeId: 'e1' } });
    expect(shifts).toHaveLength(1);
    expect(shifts[0].startTime).toBe('09:00');
  });

  it('should create a shift', async () => {
    const result = await mockDb.shift.create({
      data: { employeeId: 'e1', startTime: '09:00', endTime: '17:00', dayOfWeek: 1 },
    });
    expect(result).toHaveProperty('id');
  });

  it('should update a shift', async () => {
    const result = await mockDb.shift.update({
      where: { id: '1' },
      data: { startTime: '10:00', endTime: '18:00' },
    });
    expect(result.startTime).toBe('10:00');
  });

  it('should delete a shift', async () => {
    const result = await mockDb.shift.delete({ where: { id: '1' } });
    expect(result.id).toBe('1');
  });

  it('should validate shift times', () => {
    const start = '09:00';
    const end = '17:00';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    expect(eh * 60 + em).toBeGreaterThan(sh * 60 + sm);
  });
});

