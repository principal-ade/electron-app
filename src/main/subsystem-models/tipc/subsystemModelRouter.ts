import { tipc } from '@egoist/tipc/main';
import { SubsystemModelRegistryService } from '../../stores/SubsystemModelRegistryService';
import type { GetSubsystemModelInput } from '../../../shared/tipc/subsystemModelRouterTypes';

const registry = new SubsystemModelRegistryService();
const t = tipc.create();

export const subsystemModelRouter = {
  subsystemModel_list: t.procedure.action(() => registry.listModels()),
  subsystemModel_get: t.procedure
    .input<GetSubsystemModelInput>()
    .action(({ input }) => registry.getModel(input.id)),
};

export type SubsystemModelRouter = typeof subsystemModelRouter;
