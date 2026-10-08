import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';
import type { SubsystemModelSummary } from '../../shared/tipc/subsystemModelRouterTypes';
import { subsystemModelClient } from '../tipc/subsystemModelClient';

export class SubsystemModelService {
  static list(): Promise<SubsystemModelSummary[]> {
    return subsystemModelClient.list();
  }

  static get(id: string): Promise<SubsystemModelHydrated | null> {
    return subsystemModelClient.get({ id });
  }
}
