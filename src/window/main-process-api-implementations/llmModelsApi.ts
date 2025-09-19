import { ipcRenderer } from 'electron';
import {
  LLMModelsAPI,
  LLMModelsAPIEvent,
  GetProviderModelsRequest,
  AddModelRequest,
  UpdateModelRequest,
  DeleteModelRequest,
  ImportModelsRequest,
  LLMConfiguration,
} from '../../shared/main-process-api-interfaces/LLMModelsAPI';

export const llmModelsAPI: LLMModelsAPI = {
  getAllModels: () => ipcRenderer.invoke(LLMModelsAPIEvent.GET_ALL),

  getProviderModels: (request: GetProviderModelsRequest) =>
    ipcRenderer.invoke(LLMModelsAPIEvent.GET_PROVIDER_MODELS, request),

  addModel: (request: AddModelRequest) =>
    ipcRenderer.invoke(LLMModelsAPIEvent.ADD_MODEL, request),

  updateModel: (request: UpdateModelRequest) =>
    ipcRenderer.invoke(LLMModelsAPIEvent.UPDATE_MODEL, request),

  deleteModel: (request: DeleteModelRequest) =>
    ipcRenderer.invoke(LLMModelsAPIEvent.DELETE_MODEL, request),

  getConfiguration: () =>
    ipcRenderer.invoke(LLMModelsAPIEvent.GET_CONFIGURATION),

  updateConfiguration: (config: Partial<LLMConfiguration>) =>
    ipcRenderer.invoke(LLMModelsAPIEvent.UPDATE_CONFIGURATION, config),

  importModels: (request: ImportModelsRequest) =>
    ipcRenderer.invoke(LLMModelsAPIEvent.IMPORT_MODELS, request),

  exportModels: () => ipcRenderer.invoke(LLMModelsAPIEvent.EXPORT_MODELS),
};
