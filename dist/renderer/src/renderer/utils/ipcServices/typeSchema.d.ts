export declare const typeSchema: {
    generateSchemas: (options: {
        files: string[];
        typeNames?: string[];
        tsConfigPath?: string;
        additionalProperties?: boolean;
        strictTuples?: boolean;
        expose?: "all" | "none" | "export";
        jsDoc?: "none" | "basic" | "extended";
    }) => Promise<{
        success: boolean;
        data?: {
            schemas: Array<{
                fileName: string;
                typeName: string;
                schema: any;
            }>;
            errors: Array<{
                fileName: string;
                typeName?: string;
                error: string;
            }>;
        };
        error?: string;
    }>;
    extractTypes: (filePath: string, tsConfigPath?: string) => Promise<{
        success: boolean;
        data?: string[];
        error?: string;
    }>;
    validateTypeExists: (filePath: string, typeName: string, tsConfigPath?: string) => Promise<{
        success: boolean;
        data?: boolean;
        error?: string;
    }>;
    generateDeclarations: (filePath: string, tsConfigPath?: string) => Promise<{
        success: boolean;
        data?: {
            declarations: string;
            exportedTypes: string[];
        };
        error?: string;
    }>;
};
//# sourceMappingURL=typeSchema.d.ts.map