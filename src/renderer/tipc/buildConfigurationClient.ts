import { createClient } from '@egoist/tipc/renderer';
import type {
  BuildConfigurationSummary,
  BuildRunRecord,
  StoredBuildConfiguration,
} from '../../shared/build-configurations/types';
import type {
  BuildConfigurationRouterType,
  ConfirmBuildSecretsInput,
  GetBuildConfigurationInput,
  GetBuildRunInput,
  RunBuildConfigurationInput,
  RunBuildConfigurationResult,
  StopBuildRunInput,
  UpdateBuildConfigurationInput,
} from '../../shared/tipc/buildConfigurationRouterTypes';

interface TipcBuildConfigurationClient {
  buildConfiguration_list: () => Promise<BuildConfigurationSummary[]>;
  buildConfiguration_get: (
    input: GetBuildConfigurationInput,
  ) => Promise<StoredBuildConfiguration | null>;
  buildConfiguration_run: (
    input: RunBuildConfigurationInput,
  ) => Promise<RunBuildConfigurationResult>;
  buildConfiguration_getRun: (
    input: GetBuildRunInput,
  ) => Promise<BuildRunRecord | null>;
  buildConfiguration_stopRun: (
    input: StopBuildRunInput,
  ) => Promise<BuildRunRecord | null>;
  buildConfiguration_confirmSecrets: (
    input: ConfirmBuildSecretsInput,
  ) => Promise<StoredBuildConfiguration | null>;
  buildConfiguration_update: (
    input: UpdateBuildConfigurationInput,
  ) => Promise<StoredBuildConfiguration | null>;
}

let client: TipcBuildConfigurationClient | null = null;

function getClient(): TipcBuildConfigurationClient {
  if (!client) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error('Build configuration client is not available');
    }
    client = createClient<BuildConfigurationRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as TipcBuildConfigurationClient;
  }
  return client;
}

export const buildConfigurationClient = {
  list: () => getClient().buildConfiguration_list(),
  get: (input: GetBuildConfigurationInput) =>
    getClient().buildConfiguration_get(input),
  run: (input: RunBuildConfigurationInput) =>
    getClient().buildConfiguration_run(input),
  getRun: (input: GetBuildRunInput) =>
    getClient().buildConfiguration_getRun(input),
  stopRun: (input: StopBuildRunInput) =>
    getClient().buildConfiguration_stopRun(input),
  confirmSecrets: (input: ConfirmBuildSecretsInput) =>
    getClient().buildConfiguration_confirmSecrets(input),
  update: (input: UpdateBuildConfigurationInput) =>
    getClient().buildConfiguration_update(input),
};
