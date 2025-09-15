// Define types locally since ai.types was removed
export enum SupportedLLMProvider {
  OPENROUTER = 'openrouter',
  OLLAMA = 'ollama',
  OPENAI = 'openai'
}

export interface LLMModel {
  id: string;
  name: string;
  provider: SupportedLLMProvider;
  modelId: string;
  description?: string;
  contextLength?: number;
  capabilities?: string[];
}

export interface LLMConversation {
  id: string;
  title: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
  }>;
  createdAt: number;
  updatedAt: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface LLMProviderConfig {
  type: SupportedLLMProvider;
  enabled: boolean;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  [key: string]: unknown; // Allow provider-specific settings
}

export interface LLMConfiguration {
  defaultProvider: SupportedLLMProvider;
  providers: Record<string, LLMProviderConfig>;
  conversations?: LLMConversation[];
  activeConversationId?: string | null;
}

export enum LLMModelsAPIEvent {
  GET_ALL = 'llm-models:get-all',
  GET_PROVIDER_MODELS = 'llm-models:get-provider-models',
  ADD_MODEL = 'llm-models:add-model',
  UPDATE_MODEL = 'llm-models:update-model',
  DELETE_MODEL = 'llm-models:delete-model',
  GET_CONFIGURATION = 'llm-models:get-configuration',
  UPDATE_CONFIGURATION = 'llm-models:update-configuration',
  IMPORT_MODELS = 'llm-models:import-models',
  EXPORT_MODELS = 'llm-models:export-models',
}

export interface GetProviderModelsRequest {
  provider: SupportedLLMProvider;
}

export interface GetProviderModelsResponse {
  models: LLMModel[];
  error?: string;
}

export interface AddModelRequest {
  model: LLMModel;
}

export interface AddModelResponse {
  success: boolean;
  model?: LLMModel;
  error?: string;
}

export interface UpdateModelRequest {
  modelId: string;
  updates: Partial<LLMModel>;
}

export interface UpdateModelResponse {
  success: boolean;
  model?: LLMModel;
  error?: string;
}

export interface DeleteModelRequest {
  modelId: string;
}

export interface DeleteModelResponse {
  success: boolean;
  error?: string;
}

export interface ImportModelsRequest {
  models: LLMModel[];
  replace?: boolean;
}

export interface ImportModelsResponse {
  success: boolean;
  imported: number;
  errors?: string[];
}

export interface ExportModelsResponse {
  models: LLMModel[];
  configuration: LLMConfiguration;
}

export interface LLMModelsAPI {
  getAllModels: () => Promise<LLMModel[]>;
  getProviderModels: (request: GetProviderModelsRequest) => Promise<GetProviderModelsResponse>;
  addModel: (request: AddModelRequest) => Promise<AddModelResponse>;
  updateModel: (request: UpdateModelRequest) => Promise<UpdateModelResponse>;
  deleteModel: (request: DeleteModelRequest) => Promise<DeleteModelResponse>;
  getConfiguration: () => Promise<LLMConfiguration>;
  updateConfiguration: (config: Partial<LLMConfiguration>) => Promise<LLMConfiguration>;
  importModels: (request: ImportModelsRequest) => Promise<ImportModelsResponse>;
  exportModels: () => Promise<ExportModelsResponse>;
}