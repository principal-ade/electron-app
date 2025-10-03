export interface ActWorkflowAction {
  id: string;
  label: string;
  description?: string;
  workflowPath: string;
  requiresSecrets?: boolean;
  estimatedDurationSeconds?: number;
}

export interface RunRepositoryActionRequest {
  repoId: string;
  repoPath: string;
  workflowPath: string;
  actionId: string;
}

export interface RunRepositoryActionResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

export interface ValidateRunRequirementsRequest {
  repoId: string;
  repoPath: string;
  workflowPath: string;
  actionId: string;
}

export interface ValidateRunRequirementsResult {
  secretsConfigured: boolean;
  actInstalled: boolean;
  messages?: string[];
}

export const ActRunnerWorkflowChannels = {
  START: 'actRunner:workflow-start',
  PROGRESS: 'actRunner:workflow-progress',
  STEP: 'actRunner:workflow-step',
  ERROR: 'actRunner:workflow-error',
  COMPLETE: 'actRunner:workflow-complete',
} as const;

export type ActRunnerWorkflowChannel =
  (typeof ActRunnerWorkflowChannels)[keyof typeof ActRunnerWorkflowChannels];

export interface ActRunnerWorkflowEventBase {
  executionId: string;
  repoId: string;
  repoPath: string;
  workflowPath: string;
  actionId: string;
  timestamp: number;
}

export interface ActRunnerWorkflowStartEvent
  extends ActRunnerWorkflowEventBase {
  type: 'start';
}

export interface ActRunnerWorkflowProgressEvent
  extends ActRunnerWorkflowEventBase {
  type: 'progress';
  stream: 'stdout' | 'stderr';
  message: string;
  raw: string;
}

export interface ActRunnerWorkflowStepEvent
  extends ActRunnerWorkflowEventBase {
  type: 'step';
  status: 'success' | 'failure' | 'running';
  label: string;
  raw: string;
}

export interface ActRunnerWorkflowErrorEvent
  extends ActRunnerWorkflowEventBase {
  type: 'error';
  message: string;
  raw: string;
}

export interface ActRunnerWorkflowCompleteEvent
  extends ActRunnerWorkflowEventBase {
  type: 'complete';
  success: boolean;
  exitCode: number | null;
  durationMs: number;
}

export type ActRunnerWorkflowEvent =
  | ActRunnerWorkflowStartEvent
  | ActRunnerWorkflowProgressEvent
  | ActRunnerWorkflowStepEvent
  | ActRunnerWorkflowErrorEvent
  | ActRunnerWorkflowCompleteEvent;
