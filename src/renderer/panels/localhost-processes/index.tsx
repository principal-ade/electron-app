import type { PanelDefinition } from '@principal-ade/panel-framework-core';
import { LocalhostProcessesPanel } from './LocalhostProcessesPanel';

/**
 * Panel definition for LocalhostProcessesPanel
 */
export const localhostProcessesPanelDefinition: PanelDefinition = {
  metadata: {
    id: 'principal-ade.localhost-processes',
    name: 'Localhost Processes',
    description: 'Displays running localhost development servers with process info',
    version: '1.0.0',
    author: 'Principal ADE',
    icon: 'globe',
    slices: ['localhostServers'],
  },
  component: LocalhostProcessesPanel,
};

/**
 * Export array of panel definitions (standard panel package format)
 */
export const panels: PanelDefinition[] = [localhostProcessesPanelDefinition];

/**
 * Export the panel component directly for convenience
 */
export { LocalhostProcessesPanel } from './LocalhostProcessesPanel';
export type { RunningServer } from './LocalhostProcessesPanel';
