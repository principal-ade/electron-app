import { ipcRenderer } from 'electron';
import { LLMModelsAPIEvent } from '../../shared/main-process-api-interfaces/LLMModelsAPI';
export const llmModelsAPI = {
    getAllModels: () => ipcRenderer.invoke(LLMModelsAPIEvent.GET_ALL),
    getProviderModels: (request) => ipcRenderer.invoke(LLMModelsAPIEvent.GET_PROVIDER_MODELS, request),
    addModel: (request) => ipcRenderer.invoke(LLMModelsAPIEvent.ADD_MODEL, request),
    updateModel: (request) => ipcRenderer.invoke(LLMModelsAPIEvent.UPDATE_MODEL, request),
    deleteModel: (request) => ipcRenderer.invoke(LLMModelsAPIEvent.DELETE_MODEL, request),
    getConfiguration: () => ipcRenderer.invoke(LLMModelsAPIEvent.GET_CONFIGURATION),
    updateConfiguration: (config) => ipcRenderer.invoke(LLMModelsAPIEvent.UPDATE_CONFIGURATION, config),
    importModels: (request) => ipcRenderer.invoke(LLMModelsAPIEvent.IMPORT_MODELS, request),
    exportModels: () => ipcRenderer.invoke(LLMModelsAPIEvent.EXPORT_MODELS),
};
