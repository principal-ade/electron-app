import type { NormalizedAgentSessionEvent } from '@principal-ai/agent-monitoring';

export interface SessionSegment {
  id: string;
  startTime: number;
  endTime: number;
  events: NormalizedAgentSessionEvent[];

  // Summary statistics
  fileAccesses: Map<string, number>;
  fileWrites: Map<string, number>;
  toolCalls: Map<string, number>;
  webAccesses: string[];

  // Metadata
  primaryActivity?:
    | 'file-reading'
    | 'file-writing'
    | 'web-research'
    | 'tool-usage'
    | 'mixed';
  description?: string;
}

export interface SessionView {
  sessionId: string;
  provider: string;
  workingDirectory: string;
  normalizedWorkingDirectory?: string;

  // Time bounds
  startTime: number;
  endTime: number;
  duration: number;

  // Segments
  segments: SessionSegment[];

  // Overall statistics
  totalEvents: number;
  uniqueFilesAccessed: number;
  uniqueFilesModified: number;
  totalToolCalls: number;
  totalWebAccesses: number;

  // Repository information
  repositoriesAccessed?: Array<{
    remoteUrl: string;
    gitRoot: string;
  }>;
}
