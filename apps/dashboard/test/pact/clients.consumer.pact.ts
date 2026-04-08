import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
const { like, eachLike, uuid } = MatchersV3;

const provider = new PactV4({
  consumer: 'ServixDashboard', provider: 'ServixAPI',
  dir: path.resolve(__dirname, '..', '..', '..', '..', 'pacts'),
});

describe('Clients API Contract', () => {
  it('GET /api/v1/clients returns list', async () => {
    await provider.addInteraction()
      .given('clients exist')
      .uponReceiving('a GET request for clients list')
      .withRequest('GET', '/api/v1/clients', (b) => { b.headers({ Authorization: like('Bearer token') }); })
      .willRespondWith(200, (b) => {
        b.jsonBody({
          success: like(true),
          data: eachLike({ id: uuid(), name: like('Ahmed'), phone: like('+966512345678'), visitCount: like(5) }),
          meta: { total: like(100), page: like(1), limit: like(20) },
        });
      })
      .executeTest(async (ms) => {
        const res = await fetch(`${ms.url}/api/v1/clients`, { headers: { Authorization: 'Bearer token' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data[0]).toHaveProperty('name');
      });
  });

  it('POST /api/v1/clients creates client', async () => {
    await provider.addInteraction()
      .given('no data')
      .uponReceiving('a POST request to create client')
      .withRequest('POST', '/api/v1/clients', (b) => {
        b.headers({ Authorization: like('Bearer token'), 'Content-Type': 'application/json' });
        b.jsonBody({ name: like('Sara'), phone: like('+966523456789') });
      })
      .willRespondWith(201, (b) => { b.jsonBody({ success: like(true), data: { id: uuid(), name: like('Sara') } }); })
      .executeTest(async (ms) => {
        const res = await fetch(`${ms.url}/api/v1/clients`, {
          method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Sara', phone: '+966523456789' }),
        });
        expect(res.status).toBe(201);
      });
  });
});
