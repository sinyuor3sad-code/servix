import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/test/pact/'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.service.ts',
    '**/*.controller.ts',
    '**/*.middleware.ts',
    '!**/*.spec.ts',
    '!**/generated/**',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 88,
      lines: 90,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/core/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
};

export default config;
