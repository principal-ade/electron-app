"use strict";
/**
 * LLM Provider configuration and information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM_PROVIDERS = exports.LLMProvider = void 0;
exports.getLLMProviderInfo = getLLMProviderInfo;
exports.isValidLLMProvider = isValidLLMProvider;
var LLMProvider;
(function (LLMProvider) {
    LLMProvider["OLLAMA"] = "ollama";
    LLMProvider["OPENROUTER"] = "openrouter";
})(LLMProvider || (exports.LLMProvider = LLMProvider = {}));
exports.LLM_PROVIDERS = {
    [LLMProvider.OLLAMA]: {
        name: 'ollama',
        displayName: 'Ollama',
        type: 'local',
        description: 'Run large language models locally with complete privacy',
        requiresApiKey: false,
        documentation: {
            website: 'https://ollama.com',
            downloadUrl: 'https://ollama.com/download',
            setupGuide: 'https://github.com/ollama/ollama/blob/main/README.md',
        },
        ui: {
            color: '#F5F5F5',
            icon: 'cpu',
            tagline: 'Local AI with complete privacy',
        },
    },
    [LLMProvider.OPENROUTER]: {
        name: 'openrouter',
        displayName: 'OpenRouter',
        type: 'cloud',
        description: 'Unified API for multiple LLM providers',
        requiresApiKey: true,
        documentation: {
            website: 'https://openrouter.ai',
            setupGuide: 'https://openrouter.ai/docs#quick-start',
        },
        ui: {
            color: '#6366F1',
            icon: 'globe',
            tagline: 'Access all AI models in one place',
        },
    },
};
/**
 * Get LLM provider info
 */
function getLLMProviderInfo(provider) {
    return exports.LLM_PROVIDERS[provider];
}
/**
 * Check if a string is a valid LLM provider
 */
function isValidLLMProvider(provider) {
    return Object.values(LLMProvider).includes(provider);
}
