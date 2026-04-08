import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
const { like } = MatchersV3;
const provider = new PactV4({ consumer: 'ServixDashboard', provider: 'ServixAPI', dir: path.resolve(__dirname, '..', '..', '..', '..', 'pacts') });

describe('Reports API Contract', () => {
  it('GET /api/v1/reports/daily returns stats', async () => {
    await provider.addInteraction().given('daily data exists').uponReceiving('GET daily report')
      .withRequest('GET', '/api/v1/reports/daily', (b) => { b.headers({ Authorization: like('Bearer token') }); })
      .willRespondWith(200, (b) => {
        b.jsonBody({ success: like(true), data: { totalAppointments: like(25), completedAppointments: like(20), totalRevenue: like(5000), newClients: like(3), cancelledAppointments: like(2), topServices: like([]) } });
      })
      .executeTest(async (ms) => {
        const r = await fetch(`${ms.url}/api/v1/reports/daily`, { headers: { Authorization: 'Bearer token' } });
        expect(r.status).toBe(200);
        const b = await r.json();
        expect(b.data).toHaveProperty('totalRevenue');
      });
  });
});
