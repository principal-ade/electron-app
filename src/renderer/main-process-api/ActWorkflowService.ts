import type { ActWorkflowAction } from '../../shared/types/act.types';

export class ActWorkflowService {
  static listRepositoryActions(repoId: string): Promise<ActWorkflowAction[]> {
    return window.mainProcess.actWorkflow.listRepositoryActions(repoId);
  }
}
