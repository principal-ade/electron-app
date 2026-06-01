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
import { upsertSection } from '@principal-ade/markdown-utils';
import type { Topic } from '@principal-ai/alexandria-core-library';
import type { TopicRegistryService } from '../stores/TopicRegistryService';
import type { TrailStore } from '../file-city/trailStore';
import type { TrailIndexEntry } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TopicAPIEvent } from '../../shared/main-process-api-interfaces/TopicAPI';
import { broadcastTopicEvent } from './tipc/topicRouter';

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

async function resolveTopicTrails(
  topic: Topic,
  trailStore: TrailStore,
): Promise<TopicTrailSummary[]> {
  const { entries } = await trailStore.list();
  const byId = new Map(entries.map((e) => [e.id, e]));
  return topic.trailIds.map((trailId) => {
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
      const trails = await resolveTopicTrails(topic, trailStore);
      res.json({ success: true, topic, trails });
    } catch (err) {
      console.error('[topicRoutes] read failed', err);
      res.status(500).json({ success: false, error: 'failed to read topic' });
    }
  });

  // Append text to the topic's markdown description. Used by agents that
  // pick up context during a task (e.g. "the auth flow lives in X/Y/Z")
  // and want to leave it on the topic for the next reader. Existing
  // content is preserved; a blank-line separator goes between the old
  // body and the new text so paragraphs stay distinct.
  app.post(
    '/api/topics/:id/description/append',
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'topic id is required' });
        return;
      }
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : null;
      const text = body && typeof body.text === 'string' ? body.text : '';
      if (text.length === 0) {
        res
          .status(400)
          .json({ success: false, error: 'text (non-empty string) is required' });
        return;
      }
      try {
        const existing = await registry.getTopic(id);
        if (!existing) {
          res.status(404).json({ success: false, error: 'unknown topic id' });
          return;
        }
        const prior = (existing.description ?? '').replace(/\s+$/, '');
        const description = prior.length > 0 ? `${prior}\n\n${text}` : text;
        const topic = await registry.updateTopic(id, { description });
        broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, topic);
        const trails = await resolveTopicTrails(topic, trailStore);
        res.json({ success: true, topic, trails });
      } catch (err) {
        console.error('[topicRoutes] append failed', err);
        res
          .status(500)
          .json({ success: false, error: 'failed to append description' });
      }
    },
  );

  // Replace a single `##`/`###` section of the description in place, or append
  // it if absent. Unlike the append route (which only ever grows the body),
  // this lets an agent keep a status section truthful instead of stacking
  // contradictory blocks. Matching is exact on heading text (trailing
  // whitespace ignored); a heading that matches more than one section is
  // refused with 409 so we never clobber the wrong one — the caller resolves
  // the duplicates first. The typical loop is: GET the topic, read the exact
  // heading text, then POST it back here.
  app.post(
    '/api/topics/:id/description/section',
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'topic id is required' });
        return;
      }
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : null;
      const heading =
        body && typeof body.heading === 'string' ? body.heading : '';
      const sectionBody =
        body && typeof body.body === 'string' ? body.body : '';
      const level =
        body && typeof body.level === 'number' ? body.level : undefined;
      if (heading.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'heading (non-empty string) is required',
        });
        return;
      }
      if (sectionBody.length === 0) {
        res.status(400).json({
          success: false,
          error: 'body (non-empty string) is required',
        });
        return;
      }
      try {
        const existing = await registry.getTopic(id);
        if (!existing) {
          res.status(404).json({ success: false, error: 'unknown topic id' });
          return;
        }
        const result = upsertSection(existing.description ?? '', {
          heading,
          body: sectionBody,
          level,
        });
        if (!result.ok) {
          res.status(409).json({
            success: false,
            error: `heading "${heading}" matches ${result.count} sections; resolve the duplicates first`,
          });
          return;
        }
        const topic = await registry.updateTopic(id, {
          description: result.markdown,
        });
        broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, topic);
        const trails = await resolveTopicTrails(topic, trailStore);
        res.json({ success: true, topic, trails, action: result.action });
      } catch (err) {
        console.error('[topicRoutes] section upsert failed', err);
        res
          .status(500)
          .json({ success: false, error: 'failed to update description section' });
      }
    },
  );
}
