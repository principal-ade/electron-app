import { ipcRenderer } from 'electron';
import {
  TypeExtractionAPI,
  TypeExtractionAPIEvent,
} from '../../shared/main-process-api-interfaces/TypeExtractionAPI';
import type {
  ExtractedType,
  PackageTypes,
  PackageLayer,
} from '@principal-ai/codebase-composition';

export const typeExtractionApi: TypeExtractionAPI = {
  extractPackageTypes: async (packagePath: string): Promise<PackageTypes> => {
    return ipcRenderer.invoke(
      TypeExtractionAPIEvent.EXTRACT_PACKAGE_TYPES,
      packagePath,
    );
  },

  extractPackageTypesFromLayer: async (
    packageLayer: PackageLayer,
    workingDirectory: string,
  ): Promise<PackageTypes> => {
    return ipcRenderer.invoke(
      TypeExtractionAPIEvent.EXTRACT_PACKAGE_TYPES_FROM_LAYER,
      packageLayer,
      workingDirectory,
    );
  },

  generateDefinitionFile: async (packagePath: string): Promise<any> => {
    return ipcRenderer.invoke(
      TypeExtractionAPIEvent.GENERATE_DEFINITION_FILE,
      packagePath,
    );
  },

  extractTypes: async (packagePath: string): Promise<ExtractedType[]> => {
    return ipcRenderer.invoke(
      TypeExtractionAPIEvent.EXTRACT_TYPES,
      packagePath,
    );
  },
};
