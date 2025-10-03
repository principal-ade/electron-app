import { ipcMain } from 'electron';
import {
  ActRunnerEvents,
} from '../../../../shared/main-process-api-interfaces/ActRunnerAPI';
import {
  ActWorkflowEvents,
} from '../../../../shared/main-process-api-interfaces/ActWorkflowAPI';
import type {
  ActWorkflowAction,
} from '../../../../shared/types/act.types';
import type {
  RunRepositoryActionRequest,
  RunRepositoryActionResult,
  ValidateRunRequirementsRequest,
  ValidateRunRequirementsResult,
} from '../../../../shared/types/act.types';

const isActIntegrationEnabled =
  process.env.PLASMA_ENABLE_ACT_INTEGRATION === 'true';

const logPrefix = '[ActIntegration]';

const log = (...args: unknown[]) => {
  console.log(logPrefix, ...args);
};

const warn = (...args: unknown[]) => {
  console.warn(logPrefix, ...args);
};

const disabledResult: RunRepositoryActionResult = {
  success: false,
  error: 'ACT integration is disabled.',
};

const disabledValidation: ValidateRunRequirementsResult = {
  secretsConfigured: false,
  actInstalled: false,
  messages: ['ACT integration feature flag is disabled.'],
};

export function registerActIntegrationHandlers() {
  ipcMain.handle(
    ActWorkflowEvents.LIST_REPOSITORY_ACTIONS,
    async (_event, repoId: string): Promise<ActWorkflowAction[]> => {
      if (!isActIntegrationEnabled) {
        return [];
      }

      log('Workflow actions requested for repository', repoId);
      // Stub implementation: real workflow discovery arrives in a later phase.
      return [];
    },
  );

  ipcMain.handle(
    ActRunnerEvents.VALIDATE_RUN_REQUIREMENTS,
    async (
      _event,
      request: ValidateRunRequirementsRequest,
    ): Promise<ValidateRunRequirementsResult> => {
      if (!isActIntegrationEnabled) {
        return disabledValidation;
      }

      log('Validating run requirements', request);
      // Stubbed validation: secrets gate is handled renderer-side for now.
      return {
        secretsConfigured: true,
        actInstalled: false,
        messages: ['Act runner service stub: act binary validation pending.'],
      };
    },
  );

  ipcMain.handle(
    ActRunnerEvents.RUN_REPOSITORY_ACTION,
    async (
      _event,
      request: RunRepositoryActionRequest,
    ): Promise<RunRepositoryActionResult> => {
      if (!isActIntegrationEnabled) {
        return disabledResult;
      }

      warn('Run requested (stub implementation)', request);
      return {
        success: false,
        error: 'Act runner execution path not implemented yet.',
      };
    },
  );
}
