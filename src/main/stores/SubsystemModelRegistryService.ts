import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  deriveGraphEdges,
  isSubsystemModelDocument,
  validateSubsystemModelCrossField,
  type SubsystemComponent,
  type SubsystemModelHydrated,
  type SubsystemTrail,
} from '@principal-ai/subsystems-core';
import type { SubsystemModelSummary } from '../../shared/tipc/subsystemModelRouterTypes';

interface SubsystemModelIndex {
  version: 1;
  entries: SubsystemModelSummary[];
}

const MODEL_ID_PATTERN = /^sg-\d+-[a-z0-9]+$/;

function subsystemModelsDirectory(): string {
  const home = process.env.PRINCIPAL_SUBSYSTEM_MODELS_HOME?.trim() || homedir();
  return join(home, '.principal', 'subsystem-models');
}

function isSummary(value: unknown): value is SubsystemModelSummary {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<SubsystemModelSummary>;
  return (
    typeof entry.id === 'string' &&
    MODEL_ID_PATTERN.test(entry.id) &&
    typeof entry.title === 'string' &&
    typeof entry.updatedAt === 'string' &&
    typeof entry.componentCount === 'number' &&
    typeof entry.edgeCount === 'number'
  );
}

function isComponent(value: unknown): value is SubsystemComponent {
  if (!value || typeof value !== 'object') return false;
  const component = value as Partial<SubsystemComponent>;
  return (
    typeof component.alias === 'string' &&
    typeof component.name === 'string' &&
    typeof component.construct === 'string' &&
    typeof component.file === 'string' &&
    typeof component.purl === 'string'
  );
}

function isTrail(value: unknown): value is SubsystemTrail {
  if (!value || typeof value !== 'object') return false;
  const trail = value as Partial<SubsystemTrail>;
  return (
    typeof trail.id === 'string' &&
    typeof trail.title === 'string' &&
    Array.isArray(trail.steps) &&
    trail.steps.every(
      (step) =>
        step &&
        typeof step.from === 'string' &&
        typeof step.to === 'string' &&
        typeof step.mechanism === 'string' &&
        typeof step.file === 'string' &&
        typeof step.line === 'number' &&
        typeof step.purl === 'string' &&
        typeof step.symbol === 'string',
    )
  );
}

function sortMostRecentlyEditedFirst(
  entries: SubsystemModelSummary[],
): SubsystemModelSummary[] {
  return [...entries].sort((a, b) => {
    const byDate = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    return Number.isNaN(byDate) || byDate === 0
      ? a.title.localeCompare(b.title)
      : byDate;
  });
}

export class SubsystemModelRegistryService {
  constructor(private readonly directory = subsystemModelsDirectory()) {}

  async listModels(): Promise<SubsystemModelSummary[]> {
    try {
      const raw = await fs.readFile(
        join(this.directory, '_index.json'),
        'utf8',
      );
      const index = JSON.parse(raw) as Partial<SubsystemModelIndex>;
      if (index.version === 1 && Array.isArray(index.entries)) {
        return sortMostRecentlyEditedFirst(index.entries.filter(isSummary));
      }
    } catch {
      // Rebuild the listing from model files if the index is missing or invalid.
    }

    return this.rebuildModelSummaries();
  }

  async getModel(id: string): Promise<SubsystemModelHydrated | null> {
    if (!MODEL_ID_PATTERN.test(id)) return null;

    try {
      const raw = await fs.readFile(join(this.directory, `${id}.json`), 'utf8');
      const value: unknown = JSON.parse(raw);
      if (!isSubsystemModelDocument(value)) return null;
      if (!value.components.every(isComponent)) return null;
      if (value.trails && !value.trails.every(isTrail)) return null;
      if (validateSubsystemModelCrossField(value).length > 0) return null;

      const record = value as SubsystemModelHydrated;
      return record.id === id ? record : null;
    } catch {
      return null;
    }
  }

  private async rebuildModelSummaries(): Promise<SubsystemModelSummary[]> {
    try {
      const entries = await fs.readdir(this.directory, {
        withFileTypes: true,
      });
      const models = await Promise.all(
        entries
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.endsWith('.json') &&
              entry.name !== '_index.json' &&
              MODEL_ID_PATTERN.test(entry.name.slice(0, -5)),
          )
          .map(async (entry) => {
            const id = entry.name.slice(0, -5);
            const model = await this.getModel(id);
            if (!model) return null;

            const fileStats = await fs.stat(join(this.directory, entry.name));
            return this.toSummary(
              model,
              id,
              model.updatedAt ?? fileStats.mtime.toISOString(),
            );
          }),
      );
      return sortMostRecentlyEditedFirst(
        models.filter(
          (model): model is SubsystemModelSummary => model !== null,
        ),
      );
    } catch {
      return [];
    }
  }

  private toSummary(
    model: SubsystemModelHydrated,
    id: string,
    updatedAt: string,
  ): SubsystemModelSummary {
    return {
      id,
      title: model.title,
      description: model.description,
      updatedAt,
      componentCount: model.components.length,
      edgeCount: deriveGraphEdges(model).length,
    };
  }
}
