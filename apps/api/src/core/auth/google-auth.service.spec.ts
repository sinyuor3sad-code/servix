import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAuthService } from './google-auth.service';

// V-13a-verify — verifyIdToken now delegates to OAuth2Client (local JWKS
// signature/audience/issuer/expiry verification). Mock the client so the unit
// test exercises GoogleAuthService's mapping + error handling, not the network.
jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn() }));

const mockVerifyIdToken = jest.fn();
const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

describe('GoogleAuthService (V-13a-verify — local JWKS)', () => {
  beforeEach(() => {
    mockVerifyIdToken.mockReset();
    (OAuth2Client as unknown as jest.Mock).mockReset();
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    }));
  });

  const makeService = (clientId: string = CLIENT_ID): GoogleAuthService =>
    new GoogleAuthService({
      get: jest.fn().mockReturnValue(clientId),
    } as unknown as ConfigService);

  it('verifies locally (audience = clientId) and maps to the stable return shape', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-sub-123',
        email: 'user@gmail.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://lh3.google/pic',
      }),
    });

    const result = await makeService().verifyIdToken('id-token');

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      audience: CLIENT_ID,
    });
    expect(result).toEqual({
      sub: 'google-sub-123',
      email: 'user@gmail.com',
      email_verified: true,
      name: 'Test User',
      picture: 'https://lh3.google/pic',
    });
  });

  it('throws when GOOGLE_CLIENT_ID is unset — no verify attempt', async () => {
    await expect(makeService('').verifyIdToken('x')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('maps a verification failure (bad signature / aud / expiry) to UnauthorizedException', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token signature'));
    await expect(makeService().verifyIdToken('bad')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose payload has no sub', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => undefined });
    await expect(makeService().verifyIdToken('x')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('email_verified is false unless strictly true; missing email/name → empty string, missing picture → undefined', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 's', email_verified: undefined }),
    });

    const r = await makeService().verifyIdToken('x');

    expect(r.email_verified).toBe(false);
    expect(r.email).toBe('');
    expect(r.name).toBe('');
    expect(r.picture).toBeUndefined();
  });

  it('isEnabled reflects GOOGLE_CLIENT_ID presence', () => {
    expect(makeService().isEnabled()).toBe(true);
    expect(makeService('').isEnabled()).toBe(false);
  });
});
