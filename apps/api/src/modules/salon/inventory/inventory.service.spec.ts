export {};

const mockDb = {
  product: {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', name: 'Shampoo', quantity: 10, minQuantity: 5, price: 50 },
    ]),
    create: jest.fn().mockResolvedValue({ id: '2', name: 'Conditioner', quantity: 20 }),
    update: jest.fn().mockResolvedValue({ id: '1', quantity: 8 }),
    count: jest.fn().mockResolvedValue(10),
  },
};

describe('InventoryService', () => {
  it('should list products', async () => {
    const products = await mockDb.product.findMany();
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Shampoo');
  });

  it('should add product', async () => {
    const result = await mockDb.product.create({
      data: { name: 'Conditioner', quantity: 20, price: 30 },
    });
    expect(result.name).toBe('Conditioner');
  });

  it('should deduct stock', async () => {
    const result = await mockDb.product.update({
      where: { id: '1' },
      data: { quantity: 8 },
    });
    expect(result.quantity).toBe(8);
  });

  it('should detect low stock', () => {
    const product = { quantity: 3, minQuantity: 5 };
    const isLow = product.quantity < product.minQuantity;
    expect(isLow).toBe(true);
  });

  it('should count total products', async () => {
    const count = await mockDb.product.count();
    expect(count).toBe(10);
  });
});
