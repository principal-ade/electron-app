import { LLMModel, LLMConfiguration, SupportedLLMProvider, GetProviderModelsResponse, AddModelResponse, UpdateModelResponse, DeleteModelResponse, ImportModelsResponse, ExportModelsResponse } from '../../shared/main-process-api-interfaces/LLMModelsAPI';
declare class LLMModelsService {
    getAllModels(): Promise<LLMModel[]>;
    getProviderModels(provider: SupportedLLMProvider): Promise<GetProviderModelsResponse>;
    addModel(model: LLMModel): Promise<AddModelResponse>;
    updateModel(modelId: string, updates: Partial<LLMModel>): Promise<UpdateModelResponse>;
    deleteModel(modelId: string): Promise<DeleteModelResponse>;
    getConfiguration(): Promise<LLMConfiguration>;
    updateConfiguration(config: Partial<LLMConfiguration>): Promise<LLMConfiguration>;
    importModels(models: LLMModel[], replace?: boolean): Promise<ImportModelsResponse>;
    exportModels(): Promise<ExportModelsResponse>;
    enableProvider(provider: SupportedLLMProvider): Promise<void>;
    disableProvider(provider: SupportedLLMProvider): Promise<void>;
    setProviderApiKey(provider: SupportedLLMProvider, apiKey: string): Promise<void>;
    setProviderBaseUrl(provider: SupportedLLMProvider, baseUrl: string): Promise<void>;
    refreshOllamaModels(detectedModels: string[]): Promise<void>;
    configureOllamaModel(modelName: string): Promise<void>;
    unconfigureOllamaModel(modelName: string): Promise<void>;
}
export declare const llmModelsService: LLMModelsService;
export {};
//# sourceMappingURL=LLMModelsService.d.ts.map