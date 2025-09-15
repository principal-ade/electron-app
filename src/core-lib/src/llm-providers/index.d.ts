/**
 * LLM Provider configuration and information
 */
export declare enum LLMProvider {
    OLLAMA = "ollama",
    OPENROUTER = "openrouter"
}
export interface LLMProviderInfo {
    name: string;
    displayName: string;
    type: 'local' | 'cloud';
    description: string;
    requiresApiKey: boolean;
    documentation: {
        website: string;
        downloadUrl?: string;
        setupGuide?: string;
    };
    ui: {
        color: string;
        icon: 'cpu' | 'globe';
        tagline: string;
    };
}
export declare const LLM_PROVIDERS: Record<LLMProvider, LLMProviderInfo>;
/**
 * Get LLM provider info
 */
export declare function getLLMProviderInfo(provider: LLMProvider): LLMProviderInfo;
/**
 * Check if a string is a valid LLM provider
 */
export declare function isValidLLMProvider(provider: string): provider is LLMProvider;
//# sourceMappingURL=index.d.ts.map