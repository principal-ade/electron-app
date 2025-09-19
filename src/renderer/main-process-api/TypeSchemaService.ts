/**
 * Type Schema Service - Wrapper for type schema generation operations
 * Provides methods for generating JSON schemas from TypeScript types
 */

import type {
  TypeSchemaAPIResponse,
  TypeSchemaGenerationOptions,
  TypeSchemaResult,
  TypeSchemaError,
} from '../../shared/main-process-api-interfaces/TypeSchemaAPI';

export class TypeSchemaService {
  async generateSchemas(options: TypeSchemaGenerationOptions): Promise<
    TypeSchemaAPIResponse<{
      schemas: TypeSchemaResult[];
      errors: TypeSchemaError[];
    }>
  > {
    try {
      return await window.mainProcess.typeSchema.generateSchemas(options);
    } catch (error) {
      console.error('[TypeSchemaService] Error generating schemas:', error);
      return {
        success: false,
        error: `Failed to generate schemas: ${error}`,
      };
    }
  }

  async extractTypes(
    filePath: string,
    tsConfigPath?: string,
  ): Promise<{
    success: boolean;
    data?: string[];
    error?: string;
  }> {
    try {
      return await window.mainProcess.typeSchema.extractTypes(
        filePath,
        tsConfigPath,
      );
    } catch (error) {
      console.error('[TypeSchemaService] Error extracting types:', error);
      return {
        success: false,
        error: `Failed to extract types: ${error}`,
      };
    }
  }

  async validateTypeExists(
    filePath: string,
    typeName: string,
    tsConfigPath?: string,
  ): Promise<{
    success: boolean;
    data?: boolean;
    error?: string;
  }> {
    try {
      return await window.mainProcess.typeSchema.validateTypeExists(
        filePath,
        typeName,
        tsConfigPath,
      );
    } catch (error) {
      console.error('[TypeSchemaService] Error validating type:', error);
      return {
        success: false,
        error: `Failed to validate type: ${error}`,
      };
    }
  }

  async generateDeclarations(
    filePath: string,
    tsConfigPath?: string,
  ): Promise<{
    success: boolean;
    data?: {
      declarations: string;
      exportedTypes: string[];
    };
    error?: string;
  }> {
    try {
      return await window.mainProcess.typeSchema.generateDeclarations(
        filePath,
        tsConfigPath,
      );
    } catch (error) {
      console.error(
        '[TypeSchemaService] Error generating declarations:',
        error,
      );
      return {
        success: false,
        error: `Failed to generate declarations: ${error}`,
      };
    }
  }
}

export const typeSchemaService = new TypeSchemaService();
