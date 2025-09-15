import React from 'react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
interface PlanningEmptyStateProps {
    theme: any;
    agentsWithMCP?: SupportedAgent[];
    onStartWithAgent?: (agent: SupportedAgent) => void;
    onCreateNew?: () => void;
}
export declare const PlanningEmptyState: React.FC<PlanningEmptyStateProps>;
export {};
//# sourceMappingURL=PlanningEmptyState.d.ts.map