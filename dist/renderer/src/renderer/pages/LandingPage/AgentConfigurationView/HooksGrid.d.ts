import React from 'react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
interface HooksGridProps {
    agentType: SupportedAgent;
    color: string;
    onHooksChange?: () => void;
    showAddFormRef?: React.MutableRefObject<(() => void) | null>;
    layout?: 'grid' | 'list';
}
export declare const HooksGrid: React.FC<HooksGridProps>;
export {};
//# sourceMappingURL=HooksGrid.d.ts.map