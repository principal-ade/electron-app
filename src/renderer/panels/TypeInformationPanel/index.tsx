import type { PanelDefinition } from '@principal-ade/panel-framework-core';
import { TypeInformationPanel } from './TypeInformationPanel';

export const typeInformationPanelDefinition: PanelDefinition = {
  metadata: {
    id: 'principal-ade.type-information',
    name: 'Type Information',
    description: 'Browse and search TypeScript types in your project',
    version: '1.0.0',
    author: 'Principal ADE',
    icon: 'file-type',
    slices: [],
  },
  component: TypeInformationPanel,
};

export const panels: PanelDefinition[] = [typeInformationPanelDefinition];
export { TypeInformationPanel };
