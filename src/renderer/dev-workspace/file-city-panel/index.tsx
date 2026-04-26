import type { PanelDefinition } from '@principal-ade/panel-framework-core';
import { FileCityPanel } from './FileCityPanel';

export const fileCityPanelDefinition: PanelDefinition = {
  metadata: {
    id: 'principal-ade.file-city',
    name: 'File City',
    description: '3D file-city visualization rendered directly via FileCity3D',
    version: '1.0.0',
    author: 'Principal ADE',
    icon: 'building',
    slices: ['fileTree'],
  },
  component: FileCityPanel as PanelDefinition['component'],
};

export const panels: PanelDefinition[] = [fileCityPanelDefinition];

export { FileCityPanel } from './FileCityPanel';
export {
  buildCityDataFromContext,
  stripRootPath,
} from './buildCityDataFromContext';
