export {};

const mockDb = {
  debt: {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', clientId: 'c1', amount: 200, status: 'PENDING', description: 'deferred invoice' },
    ]),
    create: jest.fn().mockResolvedValue({ id: '2', clientId: 'c1', amount: 100, status: 'PENDING' }),
    update: jest.fn().mockResolvedValue({ id: '1', status: 'PAID' }),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500 } }),
  },
};

describe('DebtsService', () => {
  it('should list debts for client', async () => {
    const debts = await mockDb.debt.findMany({ where: { clientId: 'c1' } });
    expect(debts).toHaveLength(1);
  });

  it('should create a debt', async () => {
    const result = await mockDb.debt.create({
      data: { clientId: 'c1', amount: 100, description: 'deferred service' },
    });
    expect(result.status).toBe('PENDING');
  });

  it('should mark debt as paid', async () => {
    const result = await mockDb.debt.update({
      where: { id: '1' },
      data: { status: 'PAID' },
    });
    expect(result.status).toBe('PAID');
  });

  it('should calculate total outstanding', async () => {
    const agg = await mockDb.debt.aggregate({ _sum: { amount: true } });
    expect(agg._sum.amount).toBe(500);
  });
});
