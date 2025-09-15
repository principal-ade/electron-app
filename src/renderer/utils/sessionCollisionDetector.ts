import { HighlightLayer, LayerItem } from "@principal-ai/code-city-react";

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
export class SessionCollisionDetector {
  /**
   * Find all file collisions between the given session layers
   */
  static detectCollisions(sessionLayers: SessionLayer[]): FileCollision[] {
    const fileOperations = new Map<string, Map<string, Set<'read' | 'write'>>>();
    
    // Build a map of file -> session -> operations
    sessionLayers.forEach(({ sessionId, readLayer, writeLayer }) => {
      // Process read layer
      readLayer?.items.forEach(item => {
        if (!fileOperations.has(item.path)) {
          fileOperations.set(item.path, new Map());
        }
        const sessionOps = fileOperations.get(item.path)!.get(sessionId) || new Set();
        sessionOps.add('read');
        fileOperations.get(item.path)!.set(sessionId, sessionOps);
      });
      
      // Process write layer
      writeLayer?.items.forEach(item => {
        if (!fileOperations.has(item.path)) {
          fileOperations.set(item.path, new Map());
        }
        const sessionOps = fileOperations.get(item.path)!.get(sessionId) || new Set();
        sessionOps.add('write');
        fileOperations.get(item.path)!.set(sessionId, sessionOps);
      });
    });
    
    // Find collisions (files touched by multiple sessions)
    const collisions: FileCollision[] = [];
    
    fileOperations.forEach((sessionOps, filePath) => {
      if (sessionOps.size > 1) {
        // Multiple sessions touched this file
        const sessions = Array.from(sessionOps.entries()).map(([sessionId, ops]) => ({
          sessionId,
          operations: ops
        }));
        
        // Determine collision type and severity
        const hasWrite = sessions.some(s => s.operations.has('write'));
        const allWrite = sessions.every(s => s.operations.has('write'));
        
        let collisionType: FileCollision['collisionType'];
        let severity: FileCollision['severity'];
        
        if (allWrite) {
          collisionType = 'write-write';
          severity = 'high'; // Multiple sessions writing to same file is high risk
        } else if (hasWrite) {
          collisionType = 'read-write';
          severity = 'medium'; // One writing while others reading is medium risk
        } else {
          collisionType = 'read-read';
          severity = 'low'; // Multiple reads is low risk
        }
        
        collisions.push({
          path: filePath,
          sessions,
          collisionType,
          severity
        });
      }
    });
    
    // Sort by severity (high -> medium -> low)
    return collisions.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
  
  /**
   * Create a collision highlight layer for visualization
   */
  static createCollisionLayer(collisions: FileCollision[]): HighlightLayer {
    const items: LayerItem[] = collisions.map(collision => ({
      path: collision.path,
      type: 'file' as const,
      renderStrategy: collision.severity === 'high' ? 'glow' : 
                      collision.severity === 'medium' ? 'fill' : 
                      'border' as const
    }));
    
    return {
      id: 'file-collisions',
      name: 'File Collisions',
      enabled: true,
      color: '#f59e0b', // Amber for collisions
      opacity: 0.8,
      borderWidth: 4,
      priority: 20, // Higher priority than regular session layers
      items,
      dynamic: true
    };
  }
  
  /**
   * Get collision summary statistics
   */
  static getCollisionStats(collisions: FileCollision[]) {
    const stats = {
      total: collisions.length,
      high: collisions.filter(c => c.severity === 'high').length,
      medium: collisions.filter(c => c.severity === 'medium').length,
      low: collisions.filter(c => c.severity === 'low').length,
      writeWrite: collisions.filter(c => c.collisionType === 'write-write').length,
      readWrite: collisions.filter(c => c.collisionType === 'read-write').length,
      readRead: collisions.filter(c => c.collisionType === 'read-read').length,
    };
    
    return stats;
  }
}