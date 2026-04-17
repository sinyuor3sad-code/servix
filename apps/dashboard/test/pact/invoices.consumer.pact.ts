import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
const { like, eachLike, uuid, datetime } = MatchersV3;
const ISO_DT = "yyyy-MM-dd'T'HH:mm:ss.SSSX";
const iso8601DateTimeWithMillis = () => datetime(ISO_DT, '2026-01-01T00:00:00.000Z');

const provider = new PactV4({ consumer: 'ServixDashboard', provider: 'ServixAPI', dir: path.resolve(__dirname, '..', '..', '..', '..', 'pacts') });

describe('Invoices API Contract', () => {
  it('GET /api/v1/invoices returns list', async () => {
    await provider.addInteraction().given('invoices exist').uponReceiving('GET invoices list')
      .withRequest('GET', '/api/v1/invoices', (b) => { b.headers({ Authorization: like('Bearer token') }); })
      .willRespondWith(200, (b) => {
        b.jsonBody({ success: like(true), data: eachLike({ id: uuid(), invoiceNumber: like('INV-000001'), total: like(500), vat: like(75), status: like('PAID'), createdAt: iso8601DateTimeWithMillis() }), meta: { total: like(50) } });
      })
      .executeTest(async (ms) => { const r = await fetch(`${ms.url}/api/v1/invoices`, { headers: { Authorization: 'Bearer token' } }); expect(r.status).toBe(200); });
  });

  it('POST /api/v1/invoices creates invoice', async () => {
    await provider.addInteraction().given('appointment completed').uponReceiving('POST create invoice')
      .withRequest('POST', '/api/v1/invoices', (b) => {
        b.headers({ Authorization: like('Bearer token'), 'Content-Type': 'application/json' });
        b.jsonBody({ appointmentId: uuid(), paymentMethod: like('CASH') });
      })
      .willRespondWith(201, (b) => { b.jsonBody({ success: like(true), data: { id: uuid(), invoiceNumber: like('INV-000002') } }); })
      .executeTest(async (ms) => {
        const r = await fetch(`${ms.url}/api/v1/invoices`, { method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: '550e8400-e29b-41d4-a716-446655440010', paymentMethod: 'CASH' }) });
        expect(r.status).toBe(201);
      });
  });
});
