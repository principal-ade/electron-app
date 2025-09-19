import { ipcRenderer } from 'electron';
import {
  TypeSchemaAPI,
  TypeSchemaAPIEvent,
  TypeSchemaAPIResponse,
  TypeSchemaGenerationOptions,
  TypeSchemaResult,
  TypeSchemaError,
} from '../../shared/main-process-api-interfaces/TypeSchemaAPI';

export const typeSchemaApi: TypeSchemaAPI = {
  generateSchemas: async (
    options: TypeSchemaGenerationOptions,
  ): Promise<
    TypeSchemaAPIResponse<{
      schemas: TypeSchemaResult[];
      errors: TypeSchemaError[];
    }>
  > => {
    return ipcRenderer.invoke(TypeSchemaAPIEvent.GENERATE_SCHEMAS, options);
  },

  extractTypes: async (
    filePath: string,
    tsConfigPath?: string,
  ): Promise<TypeSchemaAPIResponse<string[]>> => {
    return ipcRenderer.invoke(TypeSchemaAPIEvent.EXTRACT_TYPES, {
      filePath,
      tsConfigPath,
    });
  },

  validateTypeExists: async (
    filePath: string,
    typeName: string,
    tsConfigPath?: string,
  ): Promise<TypeSchemaAPIResponse<boolean>> => {
    return ipcRenderer.invoke(TypeSchemaAPIEvent.VALIDATE_TYPE_EXISTS, {
      filePath,
      typeName,
      tsConfigPath,
    });
  },

  generateDeclarations: async (
    filePath: string,
    tsConfigPath?: string,
  ): Promise<
    TypeSchemaAPIResponse<{ declarations: string; exportedTypes: string[] }>
  > => {
    return ipcRenderer.invoke(TypeSchemaAPIEvent.GENERATE_DECLARATIONS, {
      filePath,
      tsConfigPath,
    });
  },
};
