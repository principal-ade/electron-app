import { ipcRenderer } from 'electron';
import { ActWorkflowEvents } from '../../shared/main-process-api-interfaces/ActWorkflowAPI';
import type { ActWorkflowAPI } from '../../shared/main-process-api-interfaces/ActWorkflowAPI';
import type { ActWorkflowAction } from '../../shared/types/act.types';

export const actWorkflowAPI: ActWorkflowAPI = {
  async listRepositoryActions(repoId: string): Promise<ActWorkflowAction[]> {
    return ipcRenderer.invoke(
      ActWorkflowEvents.LIST_REPOSITORY_ACTIONS,
      repoId,
    );
  },
};
