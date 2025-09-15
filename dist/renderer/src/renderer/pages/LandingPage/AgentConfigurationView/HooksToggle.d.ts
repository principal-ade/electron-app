import React from 'react';
import { type SupportedAgent } from "@principal-ai/agent-monitoring";
interface HooksToggleProps {
    agentType: SupportedAgent;
    hooksEnabled: boolean;
    onToggle: (enabled: boolean) => void;
    className?: string;
}
export declare const HooksToggle: React.FC<HooksToggleProps>;
export {};
//# sourceMappingURL=HooksToggle.d.ts.map