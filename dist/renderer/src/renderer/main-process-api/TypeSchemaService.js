/**
 * Type Schema Service - Wrapper for type schema generation operations
 * Provides methods for generating JSON schemas from TypeScript types
 */
export class TypeSchemaService {
    async generateSchemas(options) {
        try {
            return await window.mainProcess.typeSchema.generateSchemas(options);
        }
        catch (error) {
            console.error('[TypeSchemaService] Error generating schemas:', error);
            return {
                success: false,
                error: `Failed to generate schemas: ${error}`,
            };
        }
    }
    async extractTypes(filePath, tsConfigPath) {
        try {
            return await window.mainProcess.typeSchema.extractTypes(filePath, tsConfigPath);
        }
        catch (error) {
            console.error('[TypeSchemaService] Error extracting types:', error);
            return {
                success: false,
                error: `Failed to extract types: ${error}`
            };
        }
    }
    async validateTypeExists(filePath, typeName, tsConfigPath) {
        try {
            return await window.mainProcess.typeSchema.validateTypeExists(filePath, typeName, tsConfigPath);
        }
        catch (error) {
            console.error('[TypeSchemaService] Error validating type:', error);
            return {
                success: false,
                error: `Failed to validate type: ${error}`,
            };
        }
    }
    async generateDeclarations(filePath, tsConfigPath) {
        try {
            return await window.mainProcess.typeSchema.generateDeclarations(filePath, tsConfigPath);
        }
        catch (error) {
            console.error('[TypeSchemaService] Error generating declarations:', error);
            return {
                success: false,
                error: `Failed to generate declarations: ${error}`,
            };
        }
    }
}
export const typeSchemaService = new TypeSchemaService();
