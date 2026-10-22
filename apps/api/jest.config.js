/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.(spec|e2e-spec)\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  moduleNameMapper: {
    '^@scanflow/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    '^.+\\.js$': '<rootDir>/test/esm-to-cjs.cjs',
  },
  // Nest 12 ships ESM. Node can require() it; Jest 30 on Node 22 cannot, so compile those packages to CJS.
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm/(@nestjs\\+|jose@|pdf-lib-encrypt@)|@nestjs/|jose/|pdf-lib-encrypt/))',
  ],
  clearMocks: true,
  testTimeout: 30000,
};
