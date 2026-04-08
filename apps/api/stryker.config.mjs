/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  coverageAnalysis: 'perTest',
  
  // Only mutate critical business services
  mutate: [
    'src/modules/salon/appointments/appointments.service.ts',
    'src/core/auth/auth.service.ts',
    'src/modules/salon/invoices/invoices.service.ts',
    'src/modules/salon/coupons/coupons.service.ts',
    'src/shared/middleware/tenant.middleware.ts',
  ],

  thresholds: {
    high: 80,
    low: 60,
    break: 50, // CI fails if mutation score < 50%
  },

  // Performance tuning
  concurrency: 4,
  timeoutMS: 30000,
  tempDirName: '.stryker-tmp',
};
