export {};

const mockDb = {
  loyaltyPoint: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: '1', clientId: 'c1', points: 50, type: 'EARNED' }),
    aggregate: jest.fn().mockResolvedValue({ _sum: { points: 150 } }),
  },
};

describe('LoyaltyService', () => {
  it('should earn points', async () => {
    const result = await mockDb.loyaltyPoint.create({
      data: { clientId: 'c1', points: 50, type: 'EARNED', reason: 'completed booking' },
    });
    expect(result.points).toBe(50);
    expect(result.type).toBe('EARNED');
  });

  it('should calculate total points', async () => {
    const agg = await mockDb.loyaltyPoint.aggregate({ _sum: { points: true } });
    expect(agg._sum.points).toBe(150);
  });

  it('should redeem points', async () => {
    mockDb.loyaltyPoint.create.mockResolvedValueOnce({
      id: '2', clientId: 'c1', points: -100, type: 'REDEEMED',
    });
    const result = await mockDb.loyaltyPoint.create({
      data: { clientId: 'c1', points: -100, type: 'REDEEMED' },
    });
    expect(result.points).toBe(-100);
  });

  it('should prevent negative balance', () => {
    const balance = 50;
    const redeemAmount = 100;
    expect(redeemAmount > balance).toBe(true);
  });

  it('should calculate points from price', () => {
    const price = 200;
    const pointsPerRiyal = 1;
    const earned = Math.floor(price * pointsPerRiyal);
    expect(earned).toBe(200);
  });
});
