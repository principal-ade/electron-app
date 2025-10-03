import type {
  RunRepositoryActionRequest,
  RunRepositoryActionResult,
  ValidateRunRequirementsRequest,
  ValidateRunRequirementsResult,
} from '../types/act.types';

export enum ActRunnerEvents {
  RUN_REPOSITORY_ACTION = 'actRunner:run-repository-action',
  VALIDATE_RUN_REQUIREMENTS = 'actRunner:validate-run-requirements',
}

export interface ActRunnerAPI {
  runRepositoryAction: (
    request: RunRepositoryActionRequest,
  ) => Promise<RunRepositoryActionResult>;
  validateRunRequirements: (
    request: ValidateRunRequirementsRequest,
  ) => Promise<ValidateRunRequirementsResult>;
}
