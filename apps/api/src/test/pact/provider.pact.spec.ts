import { Verifier } from '@pact-foundation/pact';
import path from 'path';

describe('Pact Provider Verification', () => {
  it('validates the expectations of ServixDashboard', async () => {
    const verifier = new Verifier({
      providerBaseUrl: process.env.API_URL || 'http://localhost:4000',
      pactUrls: [
        path.resolve(__dirname, '..', '..', '..', '..', '..', 'pacts', 'ServixDashboard-ServixAPI.json'),
      ],
      stateHandlers: {
        'appointments exist for tenant': async () => { /* seed test appointments */ },
        'employee and client exist': async () => { /* seed employee + client */ },
        'clients exist': async () => { /* seed clients */ },
        'invoices exist': async () => { /* seed invoices */ },
        'appointment completed': async () => { /* seed completed appointment */ },
        'employees exist': async () => { /* seed employees */ },
        'services exist': async () => { /* seed services */ },
        'valid credentials': async () => { /* seed test user */ },
        'valid refresh token': async () => { /* seed valid session */ },
        'daily data exists': async () => { /* seed daily data */ },
        'no data': async () => { /* clean database */ },
      },
      logLevel: 'warn',
      timeout: 30000,
    });
    await verifier.verifyProvider();
  }, 60000);
});
