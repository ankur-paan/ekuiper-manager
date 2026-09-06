const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.next/', '<rootDir>/e2e/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.next/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    'src/lib/auth/password.ts',
    'src/lib/api.ts',
    'src/lib/network.ts',
    'src/lib/secrets.ts',
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 80, lines: 80, statements: 80 },
  },
};

module.exports = createJestConfig(customJestConfig);
