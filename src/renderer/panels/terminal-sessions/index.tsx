import type { PanelDefinition } from '@principal-ade/panel-framework-core';
import { TerminalSessionsPanel } from './TerminalSessionsPanel';

/**
 * Panel definition for TerminalSessionsPanel
 *
 * This panel displays active terminal sessions and allows users to switch
 * between them. It follows the standard panel framework conventions for
 * easy extraction to a library.
 */
export const terminalSessionsPanelDefinition: PanelDefinition = {
  metadata: {
    id: 'principal-ade.terminal-sessions',
    name: 'Terminal Sessions',
    description:
      'Displays active terminal sessions with session info and switch capability',
    version: '1.0.0',
    author: 'Principal ADE',
    icon: 'terminal',
    slices: ['terminal'],
  },
  component: TerminalSessionsPanel,
};

/**
 * Export array of panel definitions (standard panel package format)
 */
export const panels: PanelDefinition[] = [terminalSessionsPanelDefinition];

/**
 * Export the panel component directly for convenience
 */
export { TerminalSessionsPanel } from './TerminalSessionsPanel';
