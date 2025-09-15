/**
 * AI Service - Mock implementation for deprecated window.electron.ai
 *
 * This service provides placeholder methods for AI functionality that was previously
 * available through window.electron.ai. All methods throw errors indicating they
 * are not yet implemented.
 *
 * TODO: Implement these methods when AI functionality is re-enabled
 */
export interface OllamaStatus {
    isRunning: boolean;
    version?: string;
    models?: string[];
}
export interface PullProgress {
    status: string;
    digest?: string;
    total?: number;
    completed?: number;
}
export declare class AIService {
    /**
     * Analyze package.json scripts using AI
     * @throws Error - Not yet implemented
     */
    analyzePackageScripts(params: {
        packageJson: any;
        packagePath: string;
        provider: 'ollama' | 'openrouter';
    }): Promise<any>;
    /**
     * Check if Ollama is running and available
     * @throws Error - Not yet implemented
     */
    checkOllamaStatus(): Promise<OllamaStatus>;
    /**
     * Get provider configuration
     * @throws Error - Not yet implemented
     */
    getProviderConfig(provider: string): Promise<any>;
    /**
     * Pull an Ollama model
     * @throws Error - Not yet implemented
     */
    pullOllamaModel(params: {
        model: string;
        insecure?: boolean;
    }): Promise<void>;
    /**
     * Subscribe to Ollama model pull progress
     * @throws Error - Not yet implemented
     */
    onPullOllamaProgress(callback: (progress: PullProgress) => void): () => void;
}
export declare const aiService: AIService;
//# sourceMappingURL=AIService.d.ts.map