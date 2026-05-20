import type { PanelDefinition } from '@principal-ade/panel-framework-core';
import { FileCityTrailPanel } from './FileCityTrailPanel';

export const fileCityTrailPanelDefinition: PanelDefinition = {
  metadata: {
    id: 'principal-ade.file-city-trail',
    name: 'File City Trail',
    description:
      'Authored-walkthrough explorer (trail medium) — 3D file-city visualization with sequence-view markers and inline slice/diff snippets.',
    version: '0.1.0',
    author: 'Principal ADE',
    icon: 'route',
    slices: ['fileTree', 'lineCounts', 'trail'],
  },
  component: FileCityTrailPanel as PanelDefinition['component'],
};

export const panels: PanelDefinition[] = [fileCityTrailPanelDefinition];

export { FileCityTrailPanel } from './FileCityTrailPanel';
export type { TrailBriefLayout, TrailBriefLayoutState } from './FileCityTrailPanel';
