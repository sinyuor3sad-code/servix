module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/login'],
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless',
      },
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-results',
    },
  },
};
