import React from 'react';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
interface NormalizedEventCardProps {
    event: NormalizedAgentSessionEvent;
    index?: number;
    showRawData?: boolean;
    compact?: boolean;
    onReprocess?: (event: NormalizedAgentSessionEvent) => void;
    layerBadges?: React.ReactNode;
}
export declare const NormalizedEventCard: React.FC<NormalizedEventCardProps>;
export {};
//# sourceMappingURL=NormalizedEventCard.d.ts.map