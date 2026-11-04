import { BrowserWindow } from 'electron';
import { tipc } from '@egoist/tipc/main';
import type {
  ConfirmBuildSecretsInput,
  GetBuildConfigurationInput,
  GetBuildRunInput,
  RunBuildConfigurationInput,
  UpdateBuildConfigurationInput,
} from '../../../shared/tipc/buildConfigurationRouterTypes';
import {
  getBuildConfigurationStore,
  getBuildRoots,
  getBuildRunRegistry,
  getBuildSecretResolver,
  getGrantedSecretKeys,
  listRegisteredRepositoryPurls,
} from '../../builds/buildInstances';
import {
  confirmationFingerprintSource,
  secretStoreRepoId,
} from '../../../shared/build-configurations/types';
import { startBuildRun } from '../../builds/startBuildRun';
import { createTerminalSession } from '../../terminal/terminalSessionService';

const t = tipc.create();

export const buildConfigurationRouter = {
  buildConfiguration_list: t.procedure.action(() =>
    getBuildConfigurationStore().listSummaries(),
  ),
  buildConfiguration_get: t.procedure
    .input<GetBuildConfigurationInput>()
    .action(({ input }) => getBuildConfigurationStore().get(input.id)),
  /**
   * Confirm the secret set for the current content. Renderer-only: the
   * bridge has no confirm endpoint. Requires every required secret to be
   * granted first; the confirmation binds to the exact content and any
   * later material edit clears it.
   */
  buildConfiguration_confirmSecrets: t.procedure
    .input<ConfirmBuildSecretsInput>()
    .action(async ({ input }) => {
      const store = getBuildConfigurationStore();
      const config = await store.get(input.id);
      if (!config) return null;
      const granted = new Set(
        await getGrantedSecretKeys(secretStoreRepoId(input.id)),
      );
      const missing = config.secrets
        .filter((secret) => secret.required && !granted.has(secret.env))
        .map((secret) => secret.env);
      if (missing.length > 0) {
        throw new Error(
          `cannot confirm with missing secrets: ${missing.join(', ')}`,
        );
      }
      return store.update(input.id, {
        secretConfirmation: {
          fingerprint: confirmationFingerprintSource(config),
          envNames: config.secrets
            .filter((secret) => secret.required)
            .map((secret) => secret.env),
        },
      });
    }),
  buildConfiguration_run: t.procedure
    .input<RunBuildConfigurationInput>()
    .action(({ input, context }) => {
      const window = BrowserWindow.fromWebContents(context.sender);
      return startBuildRun(
        {
          store: getBuildConfigurationStore(),
          listRepositoryPurls: listRegisteredRepositoryPurls,
          getGrantedKeys: getGrantedSecretKeys,
          runs: {
            resolveSecrets: (secretRepoId, decls, options) =>
              getBuildSecretResolver().resolve(secretRepoId, decls, options),
            trackRun: (runInput) => getBuildRunRegistry().trackRun(runInput),
            getRun: (runId) => getBuildRunRegistry().getRun(runId),
            createBuildSession: async (sessionInput) => {
              if (!window || window.isDestroyed()) {
                throw new Error(
                  'no live application window to own the terminal',
                );
              }
              return createTerminalSession(sessionInput, window.id, 'renderer');
            },
            getBuildRoots,
          },
        },
        input.id,
      );
    }),
  buildConfiguration_getRun: t.procedure
    .input<GetBuildRunInput>()
    .action(async ({ input }) => getBuildRunRegistry().getRun(input.runId)),
  buildConfiguration_update: t.procedure
    .input<UpdateBuildConfigurationInput>()
    .action(({ input }) =>
      getBuildConfigurationStore().update(input.id, input.patch),
    ),
};

export type BuildConfigurationRouter = typeof buildConfigurationRouter;
