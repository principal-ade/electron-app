// Safe window API access utilities for Type Extraction
export const typeExtraction = {
    extractTypes: async (params) => {
        if (window.electron?.typeExtraction?.extractTypes) {
            return window.electron.typeExtraction.extractTypes(params);
        }
        console.warn('typeExtraction.extractTypes not available');
        return null;
    },
    // Additional methods used in the codebase but not in the type definition
    extractPackageTypes: async (packagePath) => {
        if (window.electron?.typeExtraction?.extractPackageTypes) {
            return window.electron.typeExtraction.extractPackageTypes(packagePath);
        }
        console.warn('typeExtraction.extractPackageTypes not available');
        return null;
    },
    generateDefinitionFile: async (packagePath) => {
        if (window.electron?.typeExtraction?.generateDefinitionFile) {
            return window.electron.typeExtraction.generateDefinitionFile(packagePath);
        }
        console.warn('typeExtraction.generateDefinitionFile not available');
        return null;
    },
    extractPackageTypesFromLayer: async (layer, workingDirectory) => {
        if (window.electron?.typeExtraction?.extractPackageTypesFromLayer) {
            return window.electron.typeExtraction.extractPackageTypesFromLayer(layer, workingDirectory);
        }
        console.warn('typeExtraction.extractPackageTypesFromLayer not available');
        return null;
    },
};
