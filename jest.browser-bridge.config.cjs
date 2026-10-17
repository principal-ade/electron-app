// Unit/integration coverage without requiring compiled Electron bundles.
module.exports = {
  ...require('./package.json').jest,
  setupFiles: [],
  testMatch: [
    '<rootDir>/src/main/principal-mcp/browser*.test.ts',
    '<rootDir>/src/main/processes/ProcessRegistry.test.ts',
    '<rootDir>/src/renderer/principal-window/browserTabs.test.ts',
    '<rootDir>/src/renderer/principal-window/PortalTabsContext.test.tsx',
    '<rootDir>/src/renderer/principal-window/views/ProcessesView/LocalhostBrowserTabContent.test.tsx',
  ],
};
