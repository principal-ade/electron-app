/**
 * Type Extraction Service - Wrapper for type extraction operations
 * Provides methods for extracting TypeScript types from packages and layers
 */

export class TypeExtractionService {
  async extractTypes(params: any): Promise<any> {
    try {
      return await window.mainProcess.typeExtraction.extractTypes(params);
    } catch (error) {
      console.error('[TypeExtractionService] Error extracting types:', error);
      return null;
    }
  }

  async extractPackageTypes(packagePath: string): Promise<any> {
    try {
      return await (window.mainProcess.typeExtraction as any).extractPackageTypes(
        packagePath,
      );
    } catch (error) {
      console.error('[TypeExtractionService] Error extracting package types:', error);
      return null;
    }
  }

  async generateDefinitionFile(packagePath: string): Promise<any> {
    try {
      return await (window.mainProcess.typeExtraction as any).generateDefinitionFile(
        packagePath,
      );
    } catch (error) {
      console.error('[TypeExtractionService] Error generating definition file:', error);
      return null;
    }
  }

  async extractPackageTypesFromLayer(
    layer: any,
    workingDirectory: string,
  ): Promise<any> {
    try {
      return await (
        window.mainProcess.typeExtraction as any
      ).extractPackageTypesFromLayer(layer, workingDirectory);
    } catch (error) {
      console.error('[TypeExtractionService] Error extracting types from layer:', error);
      return null;
    }
  }
}

export const typeExtractionService = new TypeExtractionService();