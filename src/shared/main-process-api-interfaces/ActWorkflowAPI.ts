import type { ActWorkflowAction } from '../types/act.types';

export enum ActWorkflowEvents {
  LIST_REPOSITORY_ACTIONS = 'actWorkflow:list-repository-actions',
}

export interface ActWorkflowAPI {
  listRepositoryActions: (repoId: string) => Promise<ActWorkflowAction[]>;
}
