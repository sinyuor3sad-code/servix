import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
const { like, eachLike, uuid } = MatchersV3;
const provider = new PactV4({ consumer: 'ServixDashboard', provider: 'ServixAPI', dir: path.resolve(__dirname, '..', '..', '..', '..', 'pacts') });

describe('Employees API Contract', () => {
  it('GET /api/v1/employees returns list', async () => {
    await provider.addInteraction().given('employees exist').uponReceiving('GET employees list')
      .withRequest('GET', '/api/v1/employees', (b) => { b.headers({ Authorization: like('Bearer token') }); })
      .willRespondWith(200, (b) => {
        b.jsonBody({ success: like(true), data: eachLike({ id: uuid(), name: like('Khalid'), phone: like('+966534567890'), role: like('EMPLOYEE'), isActive: like(true) }), meta: { total: like(10) } });
      })
      .executeTest(async (ms) => { const r = await fetch(`${ms.url}/api/v1/employees`, { headers: { Authorization: 'Bearer token' } }); expect(r.status).toBe(200); const b = await r.json(); expect(b.data[0]).toHaveProperty('name'); });
  });
});
