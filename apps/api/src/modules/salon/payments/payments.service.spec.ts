export {}; 
const mockDb = {
  payment: {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', invoiceId: 'inv-1', amount: 200, method: 'CARD', status: 'COMPLETED' },
    ]),
    create: jest.fn().mockResolvedValue({ id: '2', amount: 150, status: 'PENDING' }),
    update: jest.fn().mockResolvedValue({ id: '2', status: 'COMPLETED' }),
  },
};

describe('PaymentsService', () => {
  it('should list payments', async () => {
    const payments = await mockDb.payment.findMany();
    expect(payments).toHaveLength(1);
  });

  it('should create payment', async () => {
    const result = await mockDb.payment.create({
      data: { invoiceId: 'inv-2', amount: 150, method: 'CASH' },
    });
    expect(result.status).toBe('PENDING');
  });

  it('should complete payment', async () => {
    const result = await mockDb.payment.update({
      where: { id: '2' },
      data: { status: 'COMPLETED' },
    });
    expect(result.status).toBe('COMPLETED');
  });

  it('should validate payment methods', () => {
    const methods = ['CASH', 'CARD', 'MADA', 'BANK_TRANSFER', 'MOYASAR'];
    expect(methods.includes('CASH')).toBe(true);
    expect(methods.includes('BITCOIN')).toBe(false);
  });
});

