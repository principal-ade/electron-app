import React from 'react';
import { FileCollision } from '../../utils/sessionCollisionDetector';
interface AgentSessionCollisionIndicatorProps {
    collisions: FileCollision[];
    sessionNames?: Map<string, string>;
    onFileClick?: (filePath: string) => void;
}
export declare const AgentSessionCollisionIndicator: React.FC<AgentSessionCollisionIndicatorProps>;
export {};
//# sourceMappingURL=AgentSessionCollisionIndicator.d.ts.map