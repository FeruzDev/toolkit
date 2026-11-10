/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/packages/*/test/**/*.test.ts?(x)'],
  // temporal-polyfill (and temporal-utils) are ESM-only: let ts-jest compile it to CommonJS for tests
  transformIgnorePatterns: ['/node_modules/(?!(temporal-polyfill|temporal-utils)/)'],
  transform: {
    '^.+\.[tj]sx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { jsx: 'react', esModuleInterop: true, module: 'commonjs', moduleResolution: 'node', isolatedModules: true, target: 'ES2020', allowJs: true },
      },
    ],
  },
};
