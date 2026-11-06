import type { ActionContext } from '@egoist/tipc/main';
import type {
  BuildCheckout,
  BuildCommand,
  BuildConfigurationSummary,
  BuildRunRecord,
  BuildSecretDecl,
  StoredBuildConfiguration,
} from '../build-configurations/types';

export interface GetBuildConfigurationInput {
  id: string;
}

export interface RunBuildConfigurationInput {
  id: string;
}

export interface GetBuildRunInput {
  runId: string;
}

export interface StopBuildRunInput {
  runId: string;
}

export interface ConfirmBuildSecretsInput {
  id: string;
}

export interface UpdateBuildConfigurationInput {
  id: string;
  patch: {
    name?: string;
    checkout?: Partial<BuildCheckout>;
    command?: Partial<BuildCommand>;
    secrets?: BuildSecretDecl[];
  };
}

/** Mirrors StartBuildRunResult (defined main-side to keep shared lean). */
export type RunBuildConfigurationResult =
  | {
      ok: true;
      runId: string;
      configId: string;
      terminalSessionId: string;
      status: BuildRunRecord['status'];
    }
  | { ok: false; code: string; error: string; missing?: string[] };

export type BuildConfigurationRouterType = Record<
  string,
  {
    action: (args: {
      context: ActionContext;
      input: unknown;
    }) => Promise<unknown>;
  }
> & {
  buildConfiguration_list: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<BuildConfigurationSummary[]>;
  };
  buildConfiguration_get: {
    action: (args: {
      context: ActionContext;
      input: GetBuildConfigurationInput;
    }) => Promise<StoredBuildConfiguration | null>;
  };
  buildConfiguration_run: {
    action: (args: {
      context: ActionContext;
      input: RunBuildConfigurationInput;
    }) => Promise<RunBuildConfigurationResult>;
  };
  buildConfiguration_getRun: {
    action: (args: {
      context: ActionContext;
      input: GetBuildRunInput;
    }) => Promise<BuildRunRecord | null>;
  };
  buildConfiguration_stopRun: {
    action: (args: {
      context: ActionContext;
      input: StopBuildRunInput;
    }) => Promise<BuildRunRecord | null>;
  };
  buildConfiguration_confirmSecrets: {
    action: (args: {
      context: ActionContext;
      input: ConfirmBuildSecretsInput;
    }) => Promise<StoredBuildConfiguration | null>;
  };
  buildConfiguration_update: {
    action: (args: {
      context: ActionContext;
      input: UpdateBuildConfigurationInput;
    }) => Promise<StoredBuildConfiguration | null>;
  };
};
