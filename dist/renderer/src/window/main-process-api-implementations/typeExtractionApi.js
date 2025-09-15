import { ipcRenderer } from 'electron';
import { TypeExtractionAPIEvent, } from '../../shared/main-process-api-interfaces/TypeExtractionAPI';
export const typeExtractionApi = {
    extractPackageTypes: async (packagePath) => {
        return ipcRenderer.invoke(TypeExtractionAPIEvent.EXTRACT_PACKAGE_TYPES, packagePath);
    },
    extractPackageTypesFromLayer: async (packageLayer, workingDirectory) => {
        return ipcRenderer.invoke(TypeExtractionAPIEvent.EXTRACT_PACKAGE_TYPES_FROM_LAYER, packageLayer, workingDirectory);
    },
    generateDefinitionFile: async (packagePath) => {
        return ipcRenderer.invoke(TypeExtractionAPIEvent.GENERATE_DEFINITION_FILE, packagePath);
    },
    extractTypes: async (packagePath) => {
        return ipcRenderer.invoke(TypeExtractionAPIEvent.EXTRACT_TYPES, packagePath);
    },
};
