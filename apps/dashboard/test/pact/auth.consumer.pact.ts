import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
const { like, uuid } = MatchersV3;
const provider = new PactV4({ consumer: 'ServixDashboard', provider: 'ServixAPI', dir: path.resolve(__dirname, '..', '..', '..', '..', 'pacts') });

describe('Auth API Contract', () => {
  it('POST /api/v1/auth/login returns tokens', async () => {
    await provider.addInteraction().given('valid credentials').uponReceiving('POST login')
      .withRequest('POST', '/api/v1/auth/login', (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody({ phone: like('+966512345678'), password: like('Test123!') });
      })
      .willRespondWith(200, (b) => {
        b.jsonBody({ success: like(true), data: { accessToken: like('eyJhbGci...'), refreshToken: like('eyJhbGci...'), user: { id: uuid(), name: like('Ahmed'), role: like('owner') } } });
      })
      .executeTest(async (ms) => {
        const r = await fetch(`${ms.url}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+966512345678', password: 'Test123!' }) });
        expect(r.status).toBe(200);
        const b = await r.json();
        expect(b.data).toHaveProperty('accessToken');
      });
  });

  it('POST /api/v1/auth/refresh returns new access token', async () => {
    await provider.addInteraction().given('valid refresh token').uponReceiving('POST refresh token')
      .withRequest('POST', '/api/v1/auth/refresh', (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody({ refreshToken: like('eyJhbGci...') });
      })
      .willRespondWith(200, (b) => { b.jsonBody({ success: like(true), data: { accessToken: like('eyJhbGci...new') } }); })
      .executeTest(async (ms) => {
        const r = await fetch(`${ms.url}/api/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: 'eyJhbGci...' }) });
        expect(r.status).toBe(200);
      });
  });
});
