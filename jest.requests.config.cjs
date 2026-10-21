// Request workflow coverage without compiled Electron bundles.
module.exports = {
  ...require('./package.json').jest,
  setupFiles: [],
  testMatch: [
    '<rootDir>/src/shared/requests/*.test.ts',
    '<rootDir>/src/main/bruno/*.test.ts',
    '<rootDir>/src/main/principal-mcp/requestRoutes.test.ts',
    '<rootDir>/src/main/principal-mcp/catalogRoutes.test.ts',
    '<rootDir>/src/renderer/requests/*.test.tsx',
    '<rootDir>/src/renderer/panels/home-panel/homeTabEntries.test.ts',
    '<rootDir>/src/renderer/principal-window/PortalTabsContext.test.tsx',
  ],
};
