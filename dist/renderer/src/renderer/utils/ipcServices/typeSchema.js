// Safe window API access utilities for Type Schema
export const typeSchema = {
    generateSchemas: async (options) => {
        if (window.electron?.typeSchema?.generateSchemas) {
            return window.electron.typeSchema.generateSchemas(options);
        }
        console.warn('typeSchema.generateSchemas not available');
        return {
            success: false,
            error: 'typeSchema.generateSchemas not available',
        };
    },
    extractTypes: async (filePath, tsConfigPath) => {
        if (window.electron?.typeSchema?.extractTypes) {
            return window.electron.typeSchema.extractTypes(filePath, tsConfigPath);
        }
        console.warn('typeSchema.extractTypes not available');
        return { success: false, error: 'typeSchema.extractTypes not available' };
    },
    validateTypeExists: async (filePath, typeName, tsConfigPath) => {
        if (window.electron?.typeSchema?.validateTypeExists) {
            return window.electron.typeSchema.validateTypeExists(filePath, typeName, tsConfigPath);
        }
        console.warn('typeSchema.validateTypeExists not available');
        return {
            success: false,
            error: 'typeSchema.validateTypeExists not available',
        };
    },
    generateDeclarations: async (filePath, tsConfigPath) => {
        if (window.electron?.typeSchema?.generateDeclarations) {
            return window.electron.typeSchema.generateDeclarations(filePath, tsConfigPath);
        }
        console.warn('typeSchema.generateDeclarations not available');
        return {
            success: false,
            error: 'typeSchema.generateDeclarations not available',
        };
    },
};
