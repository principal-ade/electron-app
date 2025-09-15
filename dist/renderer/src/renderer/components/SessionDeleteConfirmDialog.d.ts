import React from 'react';
import { AgentSessionRecord } from '../../shared/sessionTypes';
interface SessionDeleteConfirmDialogProps {
    session: AgentSessionRecord;
    directory: string;
    onConfirm: (persistLayers: boolean) => void;
    onCancel: () => void;
}
export declare const SessionDeleteConfirmDialog: React.FC<SessionDeleteConfirmDialogProps>;
export {};
//# sourceMappingURL=SessionDeleteConfirmDialog.d.ts.map