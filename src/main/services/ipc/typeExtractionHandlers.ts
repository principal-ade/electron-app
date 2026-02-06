import { ipcMain } from 'electron';
import {
  TypeExtractionModule,
  PackageLayer,
} from '@principal-ai/codebase-composition';
import { TypeExtractionAPIEvent } from '../../../shared/main-process-api-interfaces/TypeExtractionAPI';

export function setupTypeExtractionHandlers() {
  const typeExtractionModule = new TypeExtractionModule();

  // Extract types from a package
  ipcMain.handle(
    TypeExtractionAPIEvent.EXTRACT_PACKAGE_TYPES,
    async (_event, packagePath: string) => {
      try {
        console.log(
          '[TypeExtraction] Extracting types from package:',
          packagePath,
        );
        const packageTypes =
          await typeExtractionModule.extractTypes(packagePath);

        return {
          success: true,
          data: packageTypes,
        };
      } catch (error: unknown) {
        console.error('[TypeExtraction] Error extracting types:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to extract types';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  // Generate type definition file
  ipcMain.handle(
    TypeExtractionAPIEvent.GENERATE_DEFINITION_FILE,
    async (_event, packagePath: string) => {
      try {
        console.log(
          '[TypeExtraction] Generating type definition file for:',
          packagePath,
        );
        const packageTypes =
          await typeExtractionModule.extractTypes(packagePath);
        const definitionContent =
          await typeExtractionModule.generateDefinitionFile(packageTypes);

        return {
          success: true,
          data: {
            content: definitionContent,
            packageName: packageTypes.packageName,
            typeCount: packageTypes.types.length,
          },
        };
      } catch (error: unknown) {
        console.error(
          '[TypeExtraction] Error generating definition file:',
          error,
        );
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate definition file';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );

  // Extract types from a PackageLayer (new API)
  ipcMain.handle(
    TypeExtractionAPIEvent.EXTRACT_PACKAGE_TYPES_FROM_LAYER,
    async (_event, packageLayer: PackageLayer, workingDirectory: string) => {
      try {
        console.log(
          '[TypeExtraction] Extracting types from package layer:',
          packageLayer.name,
        );
        const packageTypes = await typeExtractionModule.extractTypesFromLayer(
          packageLayer,
          workingDirectory,
        );

        return {
          success: true,
          data: packageTypes,
        };
      } catch (error: unknown) {
        console.error(
          '[TypeExtraction] Error extracting types from layer:',
          error,
        );
        const errorMessage = error instanceof Error ? error.message : 'Failed to extract types from layer';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  );
}
