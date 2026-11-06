import type {
  BuildConfigurationSummary,
  BuildRunRecord,
  StoredBuildConfiguration,
} from '../../shared/build-configurations/types';
import type { RunBuildConfigurationResult } from '../../shared/tipc/buildConfigurationRouterTypes';
import type { BuildSecretsRequestedEvent } from '../../shared/build-configurations/events';
import { BUILD_SECRETS_REQUESTED } from '../../shared/build-configurations/events';
import { buildConfigurationClient } from '../tipc/buildConfigurationClient';

export class BuildConfigurationService {
  static list(): Promise<BuildConfigurationSummary[]> {
    return buildConfigurationClient.list();
  }

  static get(id: string): Promise<StoredBuildConfiguration | null> {
    return buildConfigurationClient.get({ id });
  }

  static run(id: string): Promise<RunBuildConfigurationResult> {
    return buildConfigurationClient.run({ id });
  }

  static getRun(runId: string): Promise<BuildRunRecord | null> {
    return buildConfigurationClient.getRun({ runId });
  }

  static listRuns(): Promise<BuildRunRecord[]> {
    return buildConfigurationClient.listRuns();
  }

  static stopRun(runId: string): Promise<BuildRunRecord | null> {
    return buildConfigurationClient.stopRun({ runId });
  }

  static confirmSecrets(id: string): Promise<StoredBuildConfiguration | null> {
    return buildConfigurationClient.confirmSecrets({ id });
  }

  static updateSecrets(
    id: string,
    secrets: StoredBuildConfiguration['secrets'],
  ): Promise<StoredBuildConfiguration | null> {
    return buildConfigurationClient.update({ id, patch: { secrets } });
  }

  /**
   * Subscribe to agent secret requests for any config. The event carries
   * names only — never values. Returns an unsubscribe function.
   */
  static onSecretsRequested(
    callback: (event: BuildSecretsRequestedEvent) => void,
  ): () => void {
    return window.electron.ipcRenderer.on(
      BUILD_SECRETS_REQUESTED,
      (...args: unknown[]) => {
        const event = args[0] as BuildSecretsRequestedEvent | undefined;
        if (!event || typeof event.configId !== 'string') return;
        callback(event);
      },
    );
  }
}
