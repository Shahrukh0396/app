/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          strict: true,
          module: 'commonjs',
          moduleResolution: 'node',
          target: 'ES2022',
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
