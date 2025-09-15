/**
 * Type Extraction Service - Wrapper for type extraction operations
 * Provides methods for extracting TypeScript types from packages and layers
 */
export declare class TypeExtractionService {
    extractTypes(params: any): Promise<any>;
    extractPackageTypes(packagePath: string): Promise<any>;
    generateDefinitionFile(packagePath: string): Promise<any>;
    extractPackageTypesFromLayer(layer: any, workingDirectory: string): Promise<any>;
}
export declare const typeExtractionService: TypeExtractionService;
//# sourceMappingURL=TypeExtractionService.d.ts.map