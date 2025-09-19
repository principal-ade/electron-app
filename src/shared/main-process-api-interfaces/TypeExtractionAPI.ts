// Import types from core instead of duplicating them
import type {
  ExtractedType,
  PackageTypes,
  PackageLayer,
} from '@principal-ai/codebase-composition';

export enum TypeExtractionAPIEvent {
  EXTRACT_PACKAGE_TYPES = 'type-extraction:extract-package-types',
  EXTRACT_PACKAGE_TYPES_FROM_LAYER = 'type-extraction:extract-package-types-from-layer',
  GENERATE_DEFINITION_FILE = 'type-extraction:generate-definition-file',
  EXTRACT_TYPES = 'type-extraction:extract-types',
}

export interface TypeExtractionAPI {
  extractPackageTypes: (packagePath: string) => Promise<PackageTypes>;
  extractPackageTypesFromLayer: (
    packageLayer: PackageLayer,
    workingDirectory: string,
  ) => Promise<PackageTypes>;
  generateDefinitionFile: (packagePath: string) => Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }>;
  extractTypes: (packagePath: string) => Promise<ExtractedType[]>;
}
