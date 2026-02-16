/**
 * Type Extraction Service - Wrapper for type extraction operations
 * Provides methods for extracting TypeScript types from packages and layers
 */

import type { ExtractedType, PackageTypes, PackageLayer } from '@principal-ai/codebase-composition';

export class TypeExtractionService {
  async extractTypes(packagePath: string): Promise<ExtractedType[] | null> {
    try {
      return await window.mainProcess.typeExtraction.extractTypes(packagePath);
    } catch (error) {
      console.error('[TypeExtractionService] Error extracting types:', error);
      return null;
    }
  }

  async extractPackageTypes(packagePath: string): Promise<PackageTypes | null> {
    try {
      return await window.mainProcess.typeExtraction.extractPackageTypes(packagePath);
    } catch (error) {
      console.error(
        '[TypeExtractionService] Error extracting package types:',
        error,
      );
      return null;
    }
  }

  async generateDefinitionFile(packagePath: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  } | null> {
    try {
      return await window.mainProcess.typeExtraction.generateDefinitionFile(packagePath);
    } catch (error) {
      console.error(
        '[TypeExtractionService] Error generating definition file:',
        error,
      );
      return null;
    }
  }

  async extractPackageTypesFromLayer(
    layer: PackageLayer,
    workingDirectory: string,
  ): Promise<PackageTypes | null> {
    try {
      return await window.mainProcess.typeExtraction.extractPackageTypesFromLayer(layer, workingDirectory);
    } catch (error) {
      console.error(
        '[TypeExtractionService] Error extracting types from layer:',
        error,
      );
      return null;
    }
  }
}

export const typeExtractionService = new TypeExtractionService();
