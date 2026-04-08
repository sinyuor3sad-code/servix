import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
const { like, eachLike, uuid } = MatchersV3;
const provider = new PactV4({ consumer: 'ServixDashboard', provider: 'ServixAPI', dir: path.resolve(__dirname, '..', '..', '..', '..', 'pacts') });

describe('Services API Contract', () => {
  it('GET /api/v1/services returns list', async () => {
    await provider.addInteraction().given('services exist').uponReceiving('GET services list')
      .withRequest('GET', '/api/v1/services', (b) => { b.headers({ Authorization: like('Bearer token') }); })
      .willRespondWith(200, (b) => {
        b.jsonBody({ success: like(true), data: eachLike({ id: uuid(), nameAr: like('Haircut'), nameEn: like('Haircut'), price: like(100), duration: like(30), isActive: like(true) }), meta: { total: like(15) } });
      })
      .executeTest(async (ms) => { const r = await fetch(`${ms.url}/api/v1/services`, { headers: { Authorization: 'Bearer token' } }); expect(r.status).toBe(200); });
  });
});
