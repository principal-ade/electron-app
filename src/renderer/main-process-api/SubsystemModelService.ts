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

  /** Absolute path of the model's JSON on disk, or null when unknown. */
  static getFilePath(id: string): Promise<string | null> {
    return subsystemModelClient.getFilePath({ id });
  }
}
