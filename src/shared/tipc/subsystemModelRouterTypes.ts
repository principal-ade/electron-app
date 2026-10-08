import type { ActionContext } from '@egoist/tipc/main';
import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';

export interface SubsystemModelSummary {
  id: string;
  title: string;
  description?: string;
  updatedAt: string;
  componentCount: number;
  edgeCount: number;
}

export interface GetSubsystemModelInput {
  id: string;
}

export type SubsystemModelRouterType = Record<
  string,
  {
    action: (args: {
      context: ActionContext;
      input: unknown;
    }) => Promise<unknown>;
  }
> & {
  subsystemModel_list: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<SubsystemModelSummary[]>;
  };
  subsystemModel_get: {
    action: (args: {
      context: ActionContext;
      input: GetSubsystemModelInput;
    }) => Promise<SubsystemModelHydrated | null>;
  };
};
