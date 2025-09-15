import React from 'react';
import { SupportedLLMProvider } from '../../../shared/main-process-api-interfaces/LLMModelsAPI';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';
type SessionSummary = {
    title: string;
    keyPoints: string[];
    provider: SupportedLLMProvider;
    modelUsed: string;
    totalTokens?: number;
    generatedAt: number;
};
interface SegmentSummaryProps {
    segment: any;
    session: AgentSessionRecord;
    segmentSummary?: SessionSummary | null;
    onSummaryGenerated?: (summary: SessionSummary) => void;
    onRegenerateSummary?: () => void;
    selectedModel?: string;
    availableModels?: string[];
}
export declare const SegmentSummary: React.NamedExoticComponent<SegmentSummaryProps>;
export {};
//# sourceMappingURL=SegmentSummary.d.ts.map