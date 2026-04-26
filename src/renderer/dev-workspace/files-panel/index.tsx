import type { PanelDefinition } from '@principal-ade/panel-framework-core';
import { FilesPanel } from './FilesPanel';

export const filesPanelDefinition: PanelDefinition = {
  metadata: {
    id: 'principal-ade.files',
    name: 'Files',
    description: 'Repository file tree with search and selection',
    version: '1.0.0',
    author: 'Principal ADE',
    icon: 'files',
    slices: ['fileTree'],
  },
  component: FilesPanel as PanelDefinition['component'],
};

export const panels: PanelDefinition[] = [filesPanelDefinition];

export { FilesPanel } from './FilesPanel';
