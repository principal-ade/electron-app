import type { PanelDefinition } from '@principal-ade/panel-framework-core';
import { RecentRepositoriesPanel } from './RecentRepositoriesPanel';

/**
 * Panel definition for RecentRepositoriesPanel
 */
export const recentRepositoriesPanelDefinition: PanelDefinition = {
  metadata: {
    id: 'electron-app.recent-repositories',
    name: 'Recent Repositories',
    description: 'Browse and search recent repositories with quick access',
    version: '1.0.0',
    author: 'Electron App',
    icon: 'folder',
    slices: ['workspaceRepositories', 'alexandriaRepositories'],
  },
  component: RecentRepositoriesPanel,
};

/**
 * Export array of panel definitions (standard panel package format)
 */
export const panels: PanelDefinition[] = [recentRepositoriesPanelDefinition];

/**
 * Export the panel component directly for convenience
 */
export { RecentRepositoriesPanel } from './RecentRepositoriesPanel';
