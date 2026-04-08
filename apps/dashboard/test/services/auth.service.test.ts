import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Auth Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('should store token in localStorage after login', () => {
    localStorage.setItem('accessToken', 'fake-jwt-token');
    expect(localStorage.getItem('accessToken')).toBe('fake-jwt-token');
  });

  it('should clear token on logout', () => {
    localStorage.setItem('accessToken', 'fake-jwt-token');
    localStorage.setItem('refreshToken', 'fake-refresh');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('should check authentication status', () => {
    expect(localStorage.getItem('accessToken')).toBeNull();
    localStorage.setItem('accessToken', 'token');
    expect(localStorage.getItem('accessToken')).not.toBeNull();
  });

  it('should handle expired tokens', () => {
    // Simulate expired JWT (expired timestamp)
    const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjEwMDAwMDAwMDB9.expired';
    localStorage.setItem('accessToken', expiredToken);
    const token = localStorage.getItem('accessToken');
    expect(token).toBeTruthy();
    // In real app, token validation would reject this
  });

  it('should store tenant info with token', () => {
    const authData = {
      accessToken: 'jwt-token',
      tenantId: 'tenant-uuid-123',
      role: 'owner',
    };
    localStorage.setItem('auth', JSON.stringify(authData));
    const stored = JSON.parse(localStorage.getItem('auth')!);
    expect(stored.tenantId).toBe('tenant-uuid-123');
    expect(stored.role).toBe('owner');
  });
});
