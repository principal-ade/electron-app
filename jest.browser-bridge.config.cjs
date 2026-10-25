// Unit/integration coverage without requiring compiled Electron bundles.
module.exports = {
  ...require('./package.json').jest,
  setupFiles: [],
  testMatch: [
    '<rootDir>/src/main/principal-mcp/browser*.test.ts',
    '<rootDir>/src/main/principal-mcp/documentRoutes.test.ts',
    '<rootDir>/src/renderer/hooks/useTerminalLinkRouting.test.tsx',
    '<rootDir>/src/renderer/dev-workspace/file-city-panel/FloatingTerminalOverlay.test.tsx',
    '<rootDir>/src/renderer/principal-window/views/Settings/components/GeneralSettings.test.tsx',
    '<rootDir>/src/main/processes/ProcessRegistry.test.ts',
    '<rootDir>/src/renderer/principal-window/browserTabs.test.ts',
    '<rootDir>/src/renderer/principal-window/PortalTabsContext.test.tsx',
    '<rootDir>/src/renderer/principal-window/views/ProcessesView/LocalhostBrowserTabContent.test.tsx',
  ],
};
