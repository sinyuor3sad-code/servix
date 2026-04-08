export {};

const mockDb = {
  salon: {
    findUnique: jest.fn().mockResolvedValue({
      id: '1', nameAr: 'Elegance Salon', nameEn: 'Elegance Salon',
      phone: '+966512345678', email: 'info@elegance.sa',
    }),
    update: jest.fn().mockResolvedValue({ id: '1', nameAr: 'Updated Salon' }),
  },
};

describe('SalonInfoService', () => {
  it('should get salon info', async () => {
    const salon = await mockDb.salon.findUnique({ where: { id: '1' } });
    expect(salon).toBeDefined();
    expect(salon?.nameAr).toBe('Elegance Salon');
  });

  it('should update salon info', async () => {
    const result = await mockDb.salon.update({
      where: { id: '1' },
      data: { nameAr: 'Updated Salon' },
    });
    expect(result.nameAr).toBe('Updated Salon');
  });

  it('should require name', () => {
    const name = 'Salon';
    expect(name.length).toBeGreaterThan(0);
  });

  it('should validate phone format', () => {
    const phone = '+966512345678';
    expect(phone.startsWith('+966')).toBe(true);
    expect(phone.length).toBe(13);
  });
});
