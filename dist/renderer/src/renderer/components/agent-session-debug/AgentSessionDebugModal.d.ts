import React from 'react';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
import { HighlightLayer } from "@principal-ai/code-city-react";
interface AgentSessionDebugModalProps {
    sessionId: string;
    sessionName?: string;
    events?: NormalizedAgentSessionEvent[];
    highlightLayer?: HighlightLayer;
    onClose: () => void;
    onLoadEvents?: (sessionId: string) => Promise<NormalizedAgentSessionEvent[]>;
    onApplyLayer?: (layer: HighlightLayer) => void;
}
export declare const AgentSessionDebugModal: React.FC<AgentSessionDebugModalProps>;
export {};
//# sourceMappingURL=AgentSessionDebugModal.d.ts.map