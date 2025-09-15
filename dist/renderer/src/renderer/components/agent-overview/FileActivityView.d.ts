import React from 'react';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';
interface FileActivityViewProps {
    session: AgentSessionRecord;
    FILE_SIZE_THRESHOLDS: {
        WARNING: number;
        LARGE: number;
    };
}
export declare const FileActivityView: React.FC<FileActivityViewProps>;
export {};
//# sourceMappingURL=FileActivityView.d.ts.map