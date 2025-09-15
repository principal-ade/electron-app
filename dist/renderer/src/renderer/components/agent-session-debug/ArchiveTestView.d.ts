import React from 'react';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
interface ArchiveTestViewProps {
    sessionId: string;
    sessionName?: string;
    currentEvents: NormalizedAgentSessionEvent[];
    onClose?: () => void;
    onArchiveSuccess?: () => void;
}
export declare const ArchiveTestView: React.FC<ArchiveTestViewProps>;
export {};
//# sourceMappingURL=ArchiveTestView.d.ts.map