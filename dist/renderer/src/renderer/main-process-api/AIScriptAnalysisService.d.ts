import { ValidationTemplate } from '../../../shared/tool-validation-types';
export interface ScriptCategory {
    category: string;
    description: string;
    scripts: string[];
}
export interface ScriptAnalysis {
    categories: ScriptCategory[];
    suggestedActions: {
        script: string;
        command: string;
        description: string;
        severity: 'info' | 'warning' | 'error';
        timeout?: number;
    }[];
}
export declare class AIScriptAnalysisService {
    private static instance;
    private constructor();
    static getInstance(): AIScriptAnalysisService;
    /**
     * Analyze scripts using AI via IPC
     */
    analyzeScripts(packageJson: any, packagePath: string, useLocalModel?: boolean): Promise<ScriptAnalysis>;
    /**
     * Generate validation template from analysis
     */
    generateValidationTemplate(analysis: ScriptAnalysis, packageName: string, toolName?: string): ValidationTemplate;
    /**
     * Local analysis fallback
     */
    private localAnalysis;
    private inferCategoryFromCommand;
    private generateCommand;
    private getCategoryDescription;
    private getActionDescription;
    private getSeverity;
    private getTimeout;
    /**
     * Check if AI providers are available
     */
    checkAIAvailability(): Promise<{
        openrouter: boolean;
        ollama: boolean;
        preferredProvider: 'openrouter' | 'ollama' | null;
    }>;
}
export declare const aiScriptAnalysisService: AIScriptAnalysisService;
//# sourceMappingURL=AIScriptAnalysisService.d.ts.map