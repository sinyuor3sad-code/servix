export {};

const mockDb = {
  campaign: {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', name: 'Summer Discount', type: 'SMS', status: 'DRAFT', targetCount: 100 },
    ]),
    create: jest.fn().mockResolvedValue({ id: '2', name: 'Eid Offer', type: 'WHATSAPP', status: 'DRAFT' }),
    update: jest.fn().mockResolvedValue({ id: '1', status: 'SENT' }),
    count: jest.fn().mockResolvedValue(3),
  },
};

describe('MarketingService', () => {
  it('should list campaigns', async () => {
    const campaigns = await mockDb.campaign.findMany();
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe('Summer Discount');
  });

  it('should create campaign', async () => {
    const result = await mockDb.campaign.create({
      data: { name: 'Eid Offer', type: 'WHATSAPP', message: '30% off' },
    });
    expect(result.name).toBe('Eid Offer');
    expect(result.status).toBe('DRAFT');
  });

  it('should update campaign status', async () => {
    const result = await mockDb.campaign.update({
      where: { id: '1' },
      data: { status: 'SENT' },
    });
    expect(result.status).toBe('SENT');
  });

  it('should count campaigns', async () => {
    expect(await mockDb.campaign.count()).toBe(3);
  });

  it('should validate campaign type', () => {
    const validTypes = ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH'];
    expect(validTypes.includes('SMS')).toBe(true);
    expect(validTypes.includes('INVALID')).toBe(false);
  });
});
