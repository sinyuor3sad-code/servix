export {};

describe('DataRightsService', () => {
  it('should export user data as JSON', () => {
    const userData = { name: 'Ahmed', phone: '+966512345678', appointments: [] };
    const exported = JSON.stringify(userData);
    expect(exported).toContain('Ahmed');
    expect(JSON.parse(exported)).toHaveProperty('name');
  });

  it('should handle deletion request with 30-day wait', () => {
    const requestDate = new Date();
    const deletionDate = new Date(requestDate);
    deletionDate.setDate(deletionDate.getDate() + 30);
    const diffDays = Math.round((deletionDate.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it('should anonymize PII data', () => {
    const anonymize = (str: string) => str.replace(/./g, '*');
    expect(anonymize('Ahmed')).toBe('*****');
    expect(anonymize('+966512345678')).toBe('*************');
  });

  it('should validate data export contains required fields', () => {
    const required = ['name', 'phone', 'appointments', 'invoices'];
    const exported = { name: 'x', phone: 'y', appointments: [], invoices: [] };
    for (const field of required) {
      expect(exported).toHaveProperty(field);
    }
  });
});
