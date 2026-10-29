import type { ActionContext } from '@egoist/tipc/main';
import type { C4Sketch } from '@principal-ai/subsystems-react';

export type C4SketchSummary = Pick<C4Sketch, 'id' | 'title'>;
export interface GetC4SketchInput {
  id: string;
}

export type C4SketchRouterType = Record<
  string,
  {
    action: (args: {
      context: ActionContext;
      input: unknown;
    }) => Promise<unknown>;
  }
> & {
  c4Sketch_get: {
    action: (args: {
      context: ActionContext;
      input: GetC4SketchInput;
    }) => Promise<C4Sketch | null>;
  };
  c4Sketch_getSummary: {
    action: (args: {
      context: ActionContext;
      input: GetC4SketchInput;
    }) => Promise<C4SketchSummary | null>;
  };
};
