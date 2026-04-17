import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, eachLike, uuid, datetime } = MatchersV3;
const ISO_DT = "yyyy-MM-dd'T'HH:mm:ss.SSSX";
const iso8601DateTimeWithMillis = () => datetime(ISO_DT, '2026-01-01T00:00:00.000Z');

const provider = new PactV4({
  consumer: 'ServixDashboard',
  provider: 'ServixAPI',
  dir: path.resolve(__dirname, '..', '..', '..', '..', 'pacts'),
});

describe('Appointments API Contract', () => {
  it('GET /api/v1/appointments returns list', async () => {
    await provider
      .addInteraction()
      .given('appointments exist for tenant')
      .uponReceiving('a GET request for appointments list')
      .withRequest('GET', '/api/v1/appointments', (builder) => {
        builder.headers({ Authorization: like('Bearer eyJhbGci...') });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody({
          success: like(true),
          data: eachLike({
            id: uuid(),
            clientName: like('Ahmed'),
            employeeName: like('Khalid'),
            serviceName: like('Haircut'),
            startTime: iso8601DateTimeWithMillis(),
            endTime: iso8601DateTimeWithMillis(),
            status: like('CONFIRMED'),
            price: like(150),
          }),
          meta: {
            total: like(25),
            page: like(1),
            limit: like(20),
          },
        });
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/v1/appointments`, {
          headers: { Authorization: 'Bearer eyJhbGci...' },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data[0]).toHaveProperty('id');
        expect(body.data[0]).toHaveProperty('status');
        expect(body.meta).toHaveProperty('total');
      });
  });

  it('POST /api/v1/appointments creates appointment', async () => {
    await provider
      .addInteraction()
      .given('employee and client exist')
      .uponReceiving('a POST request to create appointment')
      .withRequest('POST', '/api/v1/appointments', (builder) => {
        builder.headers({
          Authorization: like('Bearer eyJhbGci...'),
          'Content-Type': 'application/json',
        });
        builder.jsonBody({
          clientId: uuid(),
          employeeId: uuid(),
          serviceId: uuid(),
          startTime: iso8601DateTimeWithMillis(),
          notes: like(''),
        });
      })
      .willRespondWith(201, (builder) => {
        builder.jsonBody({
          success: like(true),
          data: { id: uuid(), status: like('PENDING') },
        });
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/v1/appointments`, {
          method: 'POST',
          headers: { Authorization: 'Bearer eyJhbGci...', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            employeeId: '550e8400-e29b-41d4-a716-446655440002',
            serviceId: '550e8400-e29b-41d4-a716-446655440003',
            startTime: '2026-04-15T10:00:00.000Z',
            notes: '',
          }),
        });
        expect(res.status).toBe(201);
      });
  });
});
