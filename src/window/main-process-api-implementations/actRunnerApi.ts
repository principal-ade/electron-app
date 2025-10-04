import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { ActRunnerEvents } from '../../shared/main-process-api-interfaces/ActRunnerAPI';
import type { ActRunnerAPI } from '../../shared/main-process-api-interfaces/ActRunnerAPI';
import type {
  RunRepositoryActionRequest,
  RunRepositoryActionResult,
  ValidateRunRequirementsRequest,
  ValidateRunRequirementsResult,
  ActRunnerWorkflowEvent,
} from '../../shared/types/act.types';

export const actRunnerAPI: ActRunnerAPI = {
  runRepositoryAction(
    request: RunRepositoryActionRequest,
  ): Promise<RunRepositoryActionResult> {
    return ipcRenderer.invoke(ActRunnerEvents.RUN_REPOSITORY_ACTION, request);
  },
  validateRunRequirements(
    request: ValidateRunRequirementsRequest,
  ): Promise<ValidateRunRequirementsResult> {
    return ipcRenderer.invoke(
      ActRunnerEvents.VALIDATE_RUN_REQUIREMENTS,
      request,
    );
  },
  onWorkflowEvent(
    channel: string,
    callback: (event: ActRunnerWorkflowEvent) => void,
  ): () => void {
    const handler = (_event: IpcRendererEvent, data: ActRunnerWorkflowEvent) => {
      callback(data);
    };

    ipcRenderer.on(channel, handler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
};
