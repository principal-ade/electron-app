/**
 * AI Service - Mock implementation for deprecated window.electron.ai
 *
 * This service provides placeholder methods for AI functionality that was previously
 * available through window.electron.ai. All methods throw errors indicating they
 * are not yet implemented.
 *
 * TODO: Implement these methods when AI functionality is re-enabled
 */
export class AIService {
    /**
     * Analyze package.json scripts using AI
     * @throws Error - Not yet implemented
     */
    async analyzePackageScripts(params) {
        throw new Error('AIService.analyzePackageScripts is not yet implemented. ' +
            'This functionality needs to be reimplemented in the main process.');
    }
    /**
     * Check if Ollama is running and available
     * @throws Error - Not yet implemented
     */
    async checkOllamaStatus() {
        throw new Error('AIService.checkOllamaStatus is not yet implemented. ' +
            'Consider using DockerService or SystemService to check Ollama status.');
    }
    /**
     * Get provider configuration
     * @throws Error - Not yet implemented
     */
    async getProviderConfig(provider) {
        throw new Error('AIService.getProviderConfig is not yet implemented. ' +
            'Consider using LLMModelsService.getConfiguration() instead.');
    }
    /**
     * Pull an Ollama model
     * @throws Error - Not yet implemented
     */
    async pullOllamaModel(params) {
        throw new Error('AIService.pullOllamaModel is not yet implemented. ' +
            'This functionality needs to be reimplemented using Docker or shell commands.');
    }
    /**
     * Subscribe to Ollama model pull progress
     * @throws Error - Not yet implemented
     */
    onPullOllamaProgress(callback) {
        console.error('AIService.onPullOllamaProgress is not yet implemented. ' +
            'Progress tracking needs to be reimplemented.');
        // Return a no-op unsubscribe function
        return () => { };
    }
}
export const aiService = new AIService();
