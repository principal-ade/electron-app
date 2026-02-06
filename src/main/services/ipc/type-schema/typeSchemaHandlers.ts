import { ipcMain } from 'electron';
import {
  TypeSchemaService,
  TypeSchemaGenerationOptions,
} from '../../type-schema/TypeSchemaService';
import { TypeSchemaAPIEvent } from './typeSchemaEventInterface';

export function setupTypeSchemaHandlers(): void {
  const service = TypeSchemaService.getInstance();

  // Handler for generating schemas for a set of files
  ipcMain.handle(
    TypeSchemaAPIEvent.GENERATE_SCHEMAS,
    async (_event, options: TypeSchemaGenerationOptions) => {
      try {
        const result = await service.generateSchemasForLayer(options);
        return { success: true, data: result };
      } catch (error: unknown) {
        console.error('Error generating schemas:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate schemas';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  // Handler for extracting available types from a file
  ipcMain.handle(
    TypeSchemaAPIEvent.EXTRACT_TYPES,
    async (_event, data: { filePath: string; tsConfigPath?: string }) => {
      try {
        const types = await service.extractTypesFromFile(
          data.filePath,
          data.tsConfigPath,
        );
        return { success: true, data: types };
      } catch (error: unknown) {
        console.error('Error extracting types:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to extract types';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  // Handler for validating if a type exists in a file
  ipcMain.handle(
    TypeSchemaAPIEvent.VALIDATE_TYPE_EXISTS,
    async (
      _event,
      data: { filePath: string; typeName: string; tsConfigPath?: string },
    ) => {
      try {
        const exists = await service.validateTypeExists(
          data.filePath,
          data.typeName,
          data.tsConfigPath,
        );
        return { success: true, data: exists };
      } catch (error: unknown) {
        console.error('Error validating type:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to validate type';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  // Handler for generating TypeScript declarations
  ipcMain.handle(
    TypeSchemaAPIEvent.GENERATE_DECLARATIONS,
    async (_event, data: { filePath: string; tsConfigPath?: string }) => {
      try {
        const result = await service.generateDeclarations(
          data.filePath,
          data.tsConfigPath,
        );
        return { success: true, data: result };
      } catch (error: unknown) {
        console.error('Error generating declarations:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate declarations';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );
}
