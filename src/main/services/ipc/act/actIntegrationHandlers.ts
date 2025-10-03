import { BrowserWindow, ipcMain } from 'electron';
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
import {
  ActRunnerWorkflowChannels,
  type ActRunnerWorkflowEvent,
} from '../../../../shared/types/act.types';
import { ActRunnerService } from '../../act/ActRunnerService';

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

const actRunnerService = new ActRunnerService();
let workflowListenersRegistered = false;

const forwardWorkflowEvent = (
  channel: (typeof ActRunnerWorkflowChannels)[keyof typeof ActRunnerWorkflowChannels],
) =>
  (event: ActRunnerWorkflowEvent) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, event);
      }
    });
  };

function ensureWorkflowEventForwarding() {
  if (workflowListenersRegistered) {
    return;
  }

  actRunnerService.on(
    ActRunnerWorkflowChannels.START,
    forwardWorkflowEvent(ActRunnerWorkflowChannels.START),
  );
  actRunnerService.on(
    ActRunnerWorkflowChannels.PROGRESS,
    forwardWorkflowEvent(ActRunnerWorkflowChannels.PROGRESS),
  );
  actRunnerService.on(
    ActRunnerWorkflowChannels.STEP,
    forwardWorkflowEvent(ActRunnerWorkflowChannels.STEP),
  );
  actRunnerService.on(
    ActRunnerWorkflowChannels.ERROR,
    forwardWorkflowEvent(ActRunnerWorkflowChannels.ERROR),
  );
  actRunnerService.on(
    ActRunnerWorkflowChannels.COMPLETE,
    forwardWorkflowEvent(ActRunnerWorkflowChannels.COMPLETE),
  );

  workflowListenersRegistered = true;
}

export function registerActIntegrationHandlers() {
  if (isActIntegrationEnabled) {
    ensureWorkflowEventForwarding();
  }

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

      try {
        return await actRunnerService.validateRunRequirements(request);
      } catch (error) {
        console.error('[ActIntegration] Validation error:', error);
        return {
          secretsConfigured: false,
          actInstalled: false,
          messages: [
            error instanceof Error
              ? error.message
              : 'Unexpected error validating run requirements.',
          ],
        };
      }
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

      warn('Run requested', request);

      try {
        const result = await actRunnerService.runWorkflow(request);
        if (!result.success) {
          console.error('[ActIntegration] Workflow run failed to start:', result.error);
        }
        return result;
      } catch (error) {
        console.error('[ActIntegration] Failed to start workflow execution:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to start workflow execution.',
        };
      }
    },
  );
}
