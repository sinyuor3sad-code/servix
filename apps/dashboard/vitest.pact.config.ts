// Separate vitest config for Pact consumer tests.
// Pact files use `.pact.ts` suffix (vs the default `.test.ts`), and they
// generate shared contracts in ../../pacts/ that the API provider verifies.
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/pact/**/*.pact.ts'],
    // Pact's mock server starts and stops per interaction; running in parallel
    // causes port collisions.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
