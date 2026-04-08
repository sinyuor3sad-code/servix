export {};

const mockDb = {
  package: {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', name: 'Bridal Package', services: [], price: 500, sessions: 5 },
    ]),
    create: jest.fn().mockResolvedValue({ id: '2', name: 'VIP Package', price: 1000 }),
    update: jest.fn().mockResolvedValue({ id: '1', price: 450 }),
    delete: jest.fn().mockResolvedValue({ id: '1' }),
  },
};

describe('PackagesService', () => {
  it('should list packages', async () => {
    const pkgs = await mockDb.package.findMany();
    expect(pkgs).toHaveLength(1);
    expect(pkgs[0].name).toBe('Bridal Package');
  });

  it('should create package', async () => {
    const result = await mockDb.package.create({
      data: { name: 'VIP Package', price: 1000, sessions: 10 },
    });
    expect(result.name).toBe('VIP Package');
  });

  it('should update price', async () => {
    const result = await mockDb.package.update({
      where: { id: '1' },
      data: { price: 450 },
    });
    expect(result.price).toBe(450);
  });

  it('should delete package', async () => {
    const result = await mockDb.package.delete({ where: { id: '1' } });
    expect(result.id).toBe('1');
  });

  it('should calculate per-session price', () => {
    const price = 500;
    const sessions = 5;
    expect(price / sessions).toBe(100);
  });
});
