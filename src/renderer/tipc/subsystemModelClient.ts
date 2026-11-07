import { createClient } from '@egoist/tipc/renderer';
import { ipcInvoke } from './ipcTransport';
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
  subsystemModel_getFilePath: (
    input: GetSubsystemModelInput,
  ) => Promise<string | null>;
}

let client: TipcSubsystemModelClient | null = null;

function getClient(): TipcSubsystemModelClient {
  if (!client) {
    client = createClient<SubsystemModelRouterType>({
      ipcInvoke,
    }) as unknown as TipcSubsystemModelClient;
  }
  return client;
}

export const subsystemModelClient = {
  list: () => getClient().subsystemModel_list(),
  get: (input: GetSubsystemModelInput) => getClient().subsystemModel_get(input),
  getFilePath: (input: GetSubsystemModelInput) =>
    getClient().subsystemModel_getFilePath(input),
};
