/**
 * Internal Panels
 *
 * This module exports panel definitions created within the electron-app.
 * These follow the same structure as external panel packages.
 */

// Terminal Sessions Panel
export {
  panels as terminalSessionsPanels,
  terminalSessionsPanelDefinition,
  TerminalSessionsPanel,
} from './terminal-sessions';

// Recent Repositories Panel
export {
  panels as recentRepositoriesPanels,
  recentRepositoriesPanelDefinition,
  RecentRepositoriesPanel,
} from './recent-repositories';
