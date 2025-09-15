import React from 'react';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
interface EventDetailsModalProps {
    event: NormalizedAgentSessionEvent | null;
    rawEvent?: any;
    isOpen: boolean;
    onClose: () => void;
}
export declare const EventDetailsModal: React.FC<EventDetailsModalProps>;
export {};
//# sourceMappingURL=EventDetailsModal.d.ts.map