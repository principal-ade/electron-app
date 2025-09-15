/**
 * Type Schema Service - Wrapper for type schema generation operations
 * Provides methods for generating JSON schemas from TypeScript types
 */
import type { TypeSchemaAPIResponse, TypeSchemaGenerationOptions, TypeSchemaResult, TypeSchemaError } from '../../shared/main-process-api-interfaces/TypeSchemaAPI';
export declare class TypeSchemaService {
    generateSchemas(options: TypeSchemaGenerationOptions): Promise<TypeSchemaAPIResponse<{
        schemas: TypeSchemaResult[];
        errors: TypeSchemaError[];
    }>>;
    extractTypes(filePath: string, tsConfigPath?: string): Promise<{
        success: boolean;
        data?: string[];
        error?: string;
    }>;
    validateTypeExists(filePath: string, typeName: string, tsConfigPath?: string): Promise<{
        success: boolean;
        data?: boolean;
        error?: string;
    }>;
    generateDeclarations(filePath: string, tsConfigPath?: string): Promise<{
        success: boolean;
        data?: {
            declarations: string;
            exportedTypes: string[];
        };
        error?: string;
    }>;
}
export declare const typeSchemaService: TypeSchemaService;
//# sourceMappingURL=TypeSchemaService.d.ts.map