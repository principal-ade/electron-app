import { createClient } from '@egoist/tipc/renderer';
import type {
  GetSubsystemModelInput,
  SubsystemModelRouterType,
  SubsystemModelSummary,
} from '../../shared/tipc/subsystemModelRouterTypes';
import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';

interface TipcSubsystemModelClient {
  subsystemModel_list: () => Promise<SubsystemModelSummary[]>;
  subsystemModel_get: (
    input: GetSubsystemModelInput,
  ) => Promise<SubsystemModelHydrated | null>;
}

let client: TipcSubsystemModelClient | null = null;

function getClient(): TipcSubsystemModelClient {
  if (!client) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error('Subsystem model client is not available');
    }
    client = createClient<SubsystemModelRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as TipcSubsystemModelClient;
  }
  return client;
}

export const subsystemModelClient = {
  list: () => getClient().subsystemModel_list(),
  get: (input: GetSubsystemModelInput) => getClient().subsystemModel_get(input),
};
