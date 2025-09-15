import { HighlightLayer } from "@principal-ai/code-city-react";
export interface SessionLayer {
    sessionId: string;
    readLayer?: HighlightLayer;
    writeLayer?: HighlightLayer;
}
export interface FileCollision {
    path: string;
    sessions: {
        sessionId: string;
        operations: Set<'read' | 'write'>;
    }[];
    collisionType: 'read-read' | 'read-write' | 'write-write';
    severity: 'low' | 'medium' | 'high';
}
/**
 * Detects file collisions between multiple session layers
 */
export declare class SessionCollisionDetector {
    /**
     * Find all file collisions between the given session layers
     */
    static detectCollisions(sessionLayers: SessionLayer[]): FileCollision[];
    /**
     * Create a collision highlight layer for visualization
     */
    static createCollisionLayer(collisions: FileCollision[]): HighlightLayer;
    /**
     * Get collision summary statistics
     */
    static getCollisionStats(collisions: FileCollision[]): {
        total: number;
        high: number;
        medium: number;
        low: number;
        writeWrite: number;
        readWrite: number;
        readRead: number;
    };
}
//# sourceMappingURL=sessionCollisionDetector.d.ts.map