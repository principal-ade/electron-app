export interface AIConfigurationStatus {
    available: boolean;
    provider?: string;
    error?: string;
    suggestion?: string;
    loading: boolean;
}
export declare function useAIConfiguration(): {
    aiConfig: AIConfigurationStatus;
    checkAIConfiguration: () => Promise<void>;
    isAIAvailable: boolean;
};
//# sourceMappingURL=useAIConfiguration.d.ts.map