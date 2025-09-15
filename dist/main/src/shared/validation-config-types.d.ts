export interface ConfiguredValidation {
    id: string;
    workspaceRoot: string;
    packagePath: string;
    templateId: string;
    enabled: boolean;
    enabledActions: string[];
    createdAt: number;
    updatedAt: number;
}
export interface WorkspaceValidationConfig {
    workspaceRoot: string;
    validations: ConfiguredValidation[];
    settings: {
        useAI?: boolean;
        [key: string]: any;
    };
    createdAt: number;
    updatedAt: number;
}
export interface ValidationConfigStore {
    version: number;
    workspaces: {
        [workspaceRoot: string]: WorkspaceValidationConfig;
    };
}
//# sourceMappingURL=validation-config-types.d.ts.map