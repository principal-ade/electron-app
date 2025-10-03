import { ipcRenderer } from 'electron';
import { ActRunnerEvents } from '../../shared/main-process-api-interfaces/ActRunnerAPI';
import type { ActRunnerAPI } from '../../shared/main-process-api-interfaces/ActRunnerAPI';
import type {
  RunRepositoryActionRequest,
  RunRepositoryActionResult,
  ValidateRunRequirementsRequest,
  ValidateRunRequirementsResult,
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
};
