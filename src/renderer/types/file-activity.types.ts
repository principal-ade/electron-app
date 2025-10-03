export interface SessionFileActivity {
  sessionId: string;
  agentType: string;
  agentName?: string;
  filePath: string; // Relative path from repo root
  absolutePath?: string; // Full system path
  operations: Array<{
    type: 'read' | 'write' | 'edit';
    timestamp: number;
    tool?: string;
  }>;
  lastModified: number;
  isActive?: boolean; // Is this session currently active
}
