/**
 * Express routes for topic lookup over HTTP. Mounted on the Principal MCP
 * Bridge so an agent (running in a terminal we briefed) can fetch the topic
 * it was just linked to and read its title, description, and trail list.
 *
 * The act of fetching is also the link signal: the event server parses the
 * topic id out of the agent's curl URL and writes `{sessionId → topicId}`
 * into the topic registry (see TopicRegistryService.linkSession).
 */

import type { Application, Request, Response } from 'express';
import type { TopicRegistryService } from '../stores/TopicRegistryService';
import type { TrailStore } from '../file-city/trailStore';
import type { TrailIndexEntry } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

/**
 * Lightweight summary of a trail attached to a topic. Mirrors the index
 * entry fields (no payload read) plus an `href` that tells the caller
 * where to fetch the full payload. `missing` covers ids that no longer
 * resolve in the local store (the topic remembers the id, the trail was
 * deleted) so the caller sees the dangling reference.
 */
interface TopicTrailSummary {
  id: string;
  href: string;
  title?: string;
  summaryPreview?: string;
  purpose?: TrailIndexEntry['purpose'];
  markerCount?: number;
  fileCount?: number;
  signOffCount?: number;
  repoNames?: string[];
  createdAt?: string;
  updatedAt?: string;
  missing?: true;
}

function trailHref(id: string): string {
  return `/api/file-city/trail/${encodeURIComponent(id)}`;
}

export function registerTopicRoutes(
  app: Application,
  registry: TopicRegistryService,
  trailStore: TrailStore,
): void {
  app.get('/api/topics/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: 'topic id is required' });
      return;
    }
    try {
      const topic = await registry.getTopic(id);
      if (!topic) {
        res.status(404).json({ success: false, error: 'unknown topic id' });
        return;
      }

      // Resolve trail ids against the local trail index so callers get
      // names + how-to-fetch alongside the bare ids on the topic. One
      // index read covers every trail on the topic.
      const { entries } = await trailStore.list();
      const byId = new Map(entries.map((e) => [e.id, e]));
      const trails: TopicTrailSummary[] = topic.trailIds.map((trailId) => {
        const entry = byId.get(trailId);
        if (!entry) {
          return { id: trailId, href: trailHref(trailId), missing: true };
        }
        return {
          id: entry.id,
          href: trailHref(entry.id),
          title: entry.title,
          summaryPreview: entry.summaryPreview,
          purpose: entry.purpose,
          markerCount: entry.markerCount,
          fileCount: entry.fileCount,
          signOffCount: entry.signOffCount,
          repoNames: entry.repoNames,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        };
      });

      res.json({ success: true, topic, trails });
    } catch (err) {
      console.error('[topicRoutes] read failed', err);
      res.status(500).json({ success: false, error: 'failed to read topic' });
    }
  });
}
