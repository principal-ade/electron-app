import { tipc } from '@egoist/tipc/main';
import { C4SketchRegistryService } from '../../stores/C4SketchRegistryService';
import type { GetC4SketchInput } from '../../../shared/tipc/c4SketchRouterTypes';

const registry = new C4SketchRegistryService();
const t = tipc.create();

export const c4SketchRouter = {
  c4Sketch_get: t.procedure
    .input<GetC4SketchInput>()
    .action(({ input }) => registry.getSketch(input.id)),
  c4Sketch_getSummary: t.procedure
    .input<GetC4SketchInput>()
    .action(async ({ input }) => {
      const sketch = await registry.getSketch(input.id);
      return sketch ? { id: sketch.id, title: sketch.title } : null;
    }),
};
