export interface TypeSchemaGenerationOptions {
    files: string[];
    typeNames?: string[];
    tsConfigPath?: string;
    additionalProperties?: boolean;
    strictTuples?: boolean;
    expose?: 'all' | 'none' | 'export';
    jsDoc?: 'none' | 'basic' | 'extended';
}
export interface TypeSchemaResult {
    fileName: string;
    typeName: string;
    schema: any;
}
export interface TypeSchemaError {
    fileName: string;
    typeName?: string;
    error: string;
}
export declare class TypeSchemaService {
    private static instance;
    private constructor();
    static getInstance(): TypeSchemaService;
    generateSchemasForLayer(options: TypeSchemaGenerationOptions): Promise<{
        schemas: TypeSchemaResult[];
        errors: TypeSchemaError[];
    }>;
    private generateSchemaForFile;
    private findTsConfig;
    extractTypesFromFile(filePath: string, tsConfigPath?: string): Promise<string[]>;
    validateTypeExists(filePath: string, typeName: string, tsConfigPath?: string): Promise<boolean>;
    /**
     * Generate TypeScript declarations for a file using the TypeScript compiler API.
     * This is particularly useful for TSX files where we need proper React component type extraction.
     */
    generateDeclarations(filePath: string, tsConfigPath?: string): Promise<{
        declarations: string;
        exportedTypes: string[];
    }>;
    /**
     * Check if a file is a TSX/JSX file that would benefit from declaration generation
     */
    private isReactFile;
}
//# sourceMappingURL=TypeSchemaService.d.ts.map