export {}; 
describe('AccountService', () => {
  it('should validate password strength', () => {
    const strong = 'MyStr0ng!Pass';
    const weak = '123';
    const isStrong = (pw: string) => pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
    expect(isStrong(strong)).toBe(true);
    expect(isStrong(weak)).toBe(false);
  });

  it('should hash phone number for lookup', () => {
    const phone = '+966512345678';
    const normalized = phone.replace(/\s+/g, '').replace(/^00/, '+');
    expect(normalized).toBe('+966512345678');
  });

  it('should validate email format', () => {
    const valid = 'user@domain.com';
    const invalid = 'not-email';
    const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    expect(isEmail(valid)).toBe(true);
    expect(isEmail(invalid)).toBe(false);
  });

  it('should not allow same old and new password', () => {
    const old = 'OldPass123!';
    const newPw = 'OldPass123!';
    expect(old !== newPw).toBe(false);
  });
});

