import { createClient } from '@egoist/tipc/renderer';
import type { C4Sketch } from '@principal-ai/subsystems-react';
import type {
  C4SketchRouterType,
  C4SketchSummary,
  GetC4SketchInput,
} from '../../shared/tipc/c4SketchRouterTypes';

interface C4SketchClient {
  c4Sketch_get: (input: GetC4SketchInput) => Promise<C4Sketch | null>;
  c4Sketch_getSummary: (
    input: GetC4SketchInput,
  ) => Promise<C4SketchSummary | null>;
}

let client: C4SketchClient | null = null;
function getClient(): C4SketchClient {
  if (!client) {
    if (!window.electron?.ipcRenderer?.invoke)
      throw new Error('C4 sketch client is not available');
    client = createClient<C4SketchRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as C4SketchClient;
  }
  return client;
}

export class C4SketchService {
  static get(id: string): Promise<C4Sketch | null> {
    return getClient().c4Sketch_get({ id });
  }

  static getSummary(id: string): Promise<C4SketchSummary | null> {
    return getClient().c4Sketch_getSummary({ id });
  }
}
