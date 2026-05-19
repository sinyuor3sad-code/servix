module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', '@servix/servix'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['dist/', 'generated/', 'coverage/', 'node_modules/', 'test/'],
  overrides: [
    {
      // Fixture for @servix/servix/no-decimal-to-number — kept outside the
      // build's tsconfig include list so we drop project-based parsing here.
      files: ['.eslint-test/**/*.ts'],
      parserOptions: { project: null },
    },
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-empty-function': 'off',
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    // V-44 phase-1: starts as 'warn' because 6 pre-existing call sites
    // (Engineer 4 scope: pos-shifts.service, reports.service, pdf.service)
    // need their Decimal arithmetic refactored first. Flip to 'error' in a
    // single-line follow-up (V-44b) after Engineer 4's cleanup PR lands.
    '@servix/servix/no-decimal-to-number': 'warn',
  },
};
