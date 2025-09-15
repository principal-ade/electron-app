import { SupportedLLMProvider } from '../../shared/main-process-api-interfaces/LLMModelsAPI';
class LLMModelsService {
    async getAllModels() {
        return window.mainProcess.llmModels.getAllModels();
    }
    async getProviderModels(provider) {
        return window.mainProcess.llmModels.getProviderModels({ provider });
    }
    async addModel(model) {
        return window.mainProcess.llmModels.addModel({ model });
    }
    async updateModel(modelId, updates) {
        return window.mainProcess.llmModels.updateModel({ modelId, updates });
    }
    async deleteModel(modelId) {
        return window.mainProcess.llmModels.deleteModel({ modelId });
    }
    async getConfiguration() {
        return window.mainProcess.llmModels.getConfiguration();
    }
    async updateConfiguration(config) {
        return window.mainProcess.llmModels.updateConfiguration(config);
    }
    async importModels(models, replace = false) {
        return window.mainProcess.llmModels.importModels({ models, replace });
    }
    async exportModels() {
        return window.mainProcess.llmModels.exportModels();
    }
    // Convenience methods
    async enableProvider(provider) {
        const config = await this.getConfiguration();
        if (config.providers[provider]) {
            config.providers[provider].enabled = true;
            await this.updateConfiguration(config);
        }
    }
    async disableProvider(provider) {
        const config = await this.getConfiguration();
        if (config.providers[provider]) {
            config.providers[provider].enabled = false;
            await this.updateConfiguration(config);
        }
    }
    async setProviderApiKey(provider, apiKey) {
        const config = await this.getConfiguration();
        if (config.providers[provider]) {
            config.providers[provider].apiKey = apiKey;
            await this.updateConfiguration(config);
        }
    }
    async setProviderBaseUrl(provider, baseUrl) {
        const config = await this.getConfiguration();
        if (config.providers[provider]) {
            config.providers[provider].baseUrl = baseUrl;
            await this.updateConfiguration(config);
        }
    }
    // This method is deprecated - it auto-configures ALL models which is not desired
    // Use addOllamaModel or configureOllamaModel instead
    async refreshOllamaModels(detectedModels) {
        // No longer auto-configure all models
        console.warn('refreshOllamaModels is deprecated - models should be individually configured');
    }
    async configureOllamaModel(modelName) {
        const config = await this.getConfiguration();
        // Models that support tool calling
        const modelsWithToolSupport = [
            'llama3.2', 'llama3.1', 'llama-3.2', 'llama-3.1',
            'mistral:latest', 'mistral:7b-instruct', 'mixtral',
            'qwen2.5', 'qwen2', 'gemma2', 'gemma:2b',
            'command-r', 'command-r-plus',
            'deepseek-coder-v2', 'deepseek-coder:6.7b-instruct-v1.5'
        ];
        const supportsTools = modelsWithToolSupport.some(supported => modelName.toLowerCase().includes(supported));
        const newModel = {
            id: `ollama-${modelName}`,
            name: modelName,
            provider: SupportedLLMProvider.OLLAMA,
            modelId: modelName,
            capabilities: supportsTools ? ['tools'] : []
        };
        // Check if already exists
        const ollamaProvider = config.providers[SupportedLLMProvider.OLLAMA];
        const models = (ollamaProvider.models || []);
        const existingIndex = models.findIndex((m) => m.name === modelName);
        if (existingIndex === -1) {
            models.push(newModel);
            config.providers[SupportedLLMProvider.OLLAMA].models = models;
            config.providers[SupportedLLMProvider.OLLAMA].enabled = true;
            await this.updateConfiguration(config);
        }
    }
    async unconfigureOllamaModel(modelName) {
        const config = await this.getConfiguration();
        const ollamaProvider = config.providers[SupportedLLMProvider.OLLAMA];
        const models = (ollamaProvider.models || []);
        const filteredModels = models.filter((m) => m.name !== modelName);
        config.providers[SupportedLLMProvider.OLLAMA].models = filteredModels;
        // Disable provider if no models left
        if (filteredModels.length === 0) {
            config.providers[SupportedLLMProvider.OLLAMA].enabled = false;
        }
        await this.updateConfiguration(config);
    }
}
export const llmModelsService = new LLMModelsService();
