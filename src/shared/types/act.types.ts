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
  workflowPath: string;
  actionId: string;
}

export interface ValidateRunRequirementsResult {
  secretsConfigured: boolean;
  actInstalled: boolean;
  messages?: string[];
}
