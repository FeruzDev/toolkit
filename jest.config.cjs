/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/packages/*/test/**/*.test.ts?(x)'],
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react', esModuleInterop: true, module: 'commonjs', moduleResolution: 'node', isolatedModules: true, target: 'ES2020' } }],
  },
};
