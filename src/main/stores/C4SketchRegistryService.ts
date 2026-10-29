import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { C4Sketch } from '@principal-ai/subsystems-react';

const nodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    kind: z.enum(['container', 'component', 'external-system', 'person']),
    state: z.literal('proposed'),
    containerKind: z.enum(['application', 'data-store']).optional(),
    container: z.string().optional(),
    technology: z.string().optional(),
    description: z.string().optional(),
    parentId: z.string().optional(),
    members: z.array(z.string()).optional(),
  })
  .passthrough();

const sketchSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  repoKeys: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.string().optional(),
  notes: z.string().optional(),
  model: z.object({
    view: z.enum(['container', 'component']),
    system: z.object({ id: z.string(), label: z.string() }).passthrough(),
    nodes: z.array(nodeSchema),
    edges: z.array(
      z.object({
        id: z.string().min(1),
        source: z.string(),
        target: z.string(),
        label: z.string(),
        protocol: z.string().optional(),
        mechanisms: z.array(z.string()).default([]),
        count: z.number().nonnegative().default(1),
      }),
    ),
    openContainerIds: z.array(z.string()).optional(),
  }),
});

/** Read-only access to Studio's standalone authored sketches. */
export class C4SketchRegistryService {
  constructor(
    private readonly directory = process.env.PRINCIPAL_C4_SKETCHES_HOME?.trim() ||
      join(homedir(), '.principal', 'c4-sketches'),
  ) {}

  async getSketch(id: string): Promise<C4Sketch | null> {
    if (!/^c4s-[a-z0-9]+-[a-z0-9]+$/.test(id)) return null;
    try {
      const raw = await fs.readFile(join(this.directory, `${id}.json`), 'utf8');
      const result = sketchSchema.safeParse(JSON.parse(raw));
      if (!result.success || result.data.id !== id) return null;
      const { nodes, edges } = result.data.model;
      const ids = new Set(nodes.map((node) => node.id));
      const containers = new Set(
        nodes
          .filter((node) => node.kind === 'container')
          .map((node) => node.id),
      );
      if (
        ids.size !== nodes.length ||
        new Set(edges.map((edge) => edge.id)).size !== edges.length
      )
        return null;
      if (
        nodes.some(
          (node) =>
            (node.kind === 'container' && !node.containerKind) ||
            (node.kind === 'component' &&
              (!node.container || !containers.has(node.container))),
        )
      )
        return null;
      if (edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target)))
        return null;
      return result.data as C4Sketch;
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      )
        return null;
      throw error;
    }
  }
}
