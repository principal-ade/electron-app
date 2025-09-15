import { ipcRenderer } from 'electron';
import { TypeSchemaAPIEvent } from '../../shared/main-process-api-interfaces/TypeSchemaAPI';
export const typeSchemaApi = {
    generateSchemas: async (options) => {
        return ipcRenderer.invoke(TypeSchemaAPIEvent.GENERATE_SCHEMAS, options);
    },
    extractTypes: async (filePath, tsConfigPath) => {
        return ipcRenderer.invoke(TypeSchemaAPIEvent.EXTRACT_TYPES, {
            filePath,
            tsConfigPath,
        });
    },
    validateTypeExists: async (filePath, typeName, tsConfigPath) => {
        return ipcRenderer.invoke(TypeSchemaAPIEvent.VALIDATE_TYPE_EXISTS, {
            filePath,
            typeName,
            tsConfigPath,
        });
    },
    generateDeclarations: async (filePath, tsConfigPath) => {
        return ipcRenderer.invoke(TypeSchemaAPIEvent.GENERATE_DECLARATIONS, {
            filePath,
            tsConfigPath,
        });
    },
};
