// Define types locally since ai.types was removed
export var SupportedLLMProvider;
(function (SupportedLLMProvider) {
    SupportedLLMProvider["OPENROUTER"] = "openrouter";
    SupportedLLMProvider["OLLAMA"] = "ollama";
    SupportedLLMProvider["OPENAI"] = "openai";
})(SupportedLLMProvider || (SupportedLLMProvider = {}));
export var LLMModelsAPIEvent;
(function (LLMModelsAPIEvent) {
    LLMModelsAPIEvent["GET_ALL"] = "llm-models:get-all";
    LLMModelsAPIEvent["GET_PROVIDER_MODELS"] = "llm-models:get-provider-models";
    LLMModelsAPIEvent["ADD_MODEL"] = "llm-models:add-model";
    LLMModelsAPIEvent["UPDATE_MODEL"] = "llm-models:update-model";
    LLMModelsAPIEvent["DELETE_MODEL"] = "llm-models:delete-model";
    LLMModelsAPIEvent["GET_CONFIGURATION"] = "llm-models:get-configuration";
    LLMModelsAPIEvent["UPDATE_CONFIGURATION"] = "llm-models:update-configuration";
    LLMModelsAPIEvent["IMPORT_MODELS"] = "llm-models:import-models";
    LLMModelsAPIEvent["EXPORT_MODELS"] = "llm-models:export-models";
})(LLMModelsAPIEvent || (LLMModelsAPIEvent = {}));
