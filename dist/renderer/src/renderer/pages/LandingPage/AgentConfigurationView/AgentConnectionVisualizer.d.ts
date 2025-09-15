import React from 'react';
import { type SupportedAgent } from "@principal-ai/agent-monitoring";
interface AgentConnectionVisualizerProps {
    agentType: SupportedAgent;
    isInstalled: boolean;
    hasHooks: boolean;
    hasMCP?: boolean;
    className?: string;
}
export declare const AgentConnectionVisualizer: React.FC<AgentConnectionVisualizerProps>;
export {};
//# sourceMappingURL=AgentConnectionVisualizer.d.ts.map