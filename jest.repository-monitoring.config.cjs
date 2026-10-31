// Repository monitoring adapters and diagnostics, without compiled Electron bundles.
module.exports = {
  ...require('./package.json').jest,
  setupFiles: [],
  setupFilesAfterEnv: [],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/main/repository-monitoring/*.test.ts',
    '<rootDir>/src/renderer/principal-window/views/SystemMonitor/*.test.{ts,tsx}',
  ],
};
