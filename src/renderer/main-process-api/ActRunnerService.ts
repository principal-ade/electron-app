import type {
  RunRepositoryActionRequest,
  RunRepositoryActionResult,
  ValidateRunRequirementsRequest,
  ValidateRunRequirementsResult,
} from '../../shared/types/act.types';

export class ActRunnerService {
  static runRepositoryAction(
    request: RunRepositoryActionRequest,
  ): Promise<RunRepositoryActionResult> {
    return window.mainProcess.actRunner.runRepositoryAction(request);
  }

  static validateRunRequirements(
    request: ValidateRunRequirementsRequest,
  ): Promise<ValidateRunRequirementsResult> {
    return window.mainProcess.actRunner.validateRunRequirements(request);
  }
}
