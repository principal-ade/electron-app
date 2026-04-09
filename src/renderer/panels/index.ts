/**
 * Internal Panels
 *
 * This module exports panel definitions created within the electron-app.
 * These follow the same structure as external panel packages.
 */

// Localhost Processes Panel
export {
  panels as localhostProcessesPanels,
  localhostProcessesPanelDefinition,
  LocalhostProcessesPanel,
  type RunningServer,
} from './localhost-processes';

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
