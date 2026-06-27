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
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { validateTopicLinks } from './validateTopicLinks';
import type { TrailIndexEntry } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TopicAPIEvent } from '../../shared/main-process-api-interfaces/TopicAPI';
import type { TopicActivateEvent } from '../../shared/main-process-api-interfaces/TopicAPI';
import { broadcastTopicEvent } from './tipc/topicRouter';
import { focusedOrMainWindow } from '../window/modernWindowManager';

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

const DESCRIPTION_PREVIEW_MAX = 200;

/** First ~200 chars of a topic description, for the payload-free list route. */
function descriptionPreview(description?: string): string {
  if (!description) return '';
  const trimmed = description.trim();
  if (trimmed.length <= DESCRIPTION_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, DESCRIPTION_PREVIEW_MAX - 1)}…`;
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

/**
 * Collect the repo purls a topic "claims" — the union of the Alexandria purls
 * of the repos its trails were authored in. Used to scope link validation: a
 * reference into a repo not in this set is flagged as out-of-scope. Trails whose
 * repo isn't registered (or that are repo-agnostic) simply don't contribute; an
 * empty set means "don't scope-check" (every purl is treated as in-scope).
 */
async function collectTopicRepoPurls(
  topic: Topic,
  trailStore: TrailStore,
): Promise<string[]> {
  const alexandria = AlexandriaRegistryService.getInstance();
  const { entries } = await trailStore.list();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const purls = new Set<string>();
  for (const trailId of topic.trailIds) {
    const entry = byId.get(trailId);
    if (!entry?.repositoryPath) continue;
    const repo = await alexandria.getRepositoryByPath(entry.repositoryPath);
    if (repo?.purl) purls.add(String(repo.purl));
  }
  return [...purls];
}

export function registerTopicRoutes(
  app: Application,
  registry: TopicRegistryService,
  trailStore: TrailStore,
): void {
  // Create a local topic. The agent analogue of the in-app UI's "new topic"
  // affordance (TIPC topic_createTopic): a briefed terminal can mint a topic
  // to bundle the trails it's about to author. The topic is local-only until
  // published from the app UI — `id`, timestamps, and `createdBy` are filled
  // in by the registry when omitted. Returns the same `{ topic, trails }`
  // shape as the read route so the caller can immediately link/append.
  app.post('/api/topics', async (req: Request, res: Response) => {
    const body =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : null;
    const title =
      body && typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length === 0) {
      res.status(400).json({
        success: false,
        error: 'title (non-empty string) is required',
      });
      return;
    }
    const description =
      body && typeof body.description === 'string' ? body.description : undefined;
    let trailIds: string[] | undefined;
    if (body && body.trailIds !== undefined) {
      if (
        !Array.isArray(body.trailIds) ||
        !body.trailIds.every((t) => typeof t === 'string')
      ) {
        res.status(400).json({
          success: false,
          error: 'trailIds must be an array of strings',
        });
        return;
      }
      trailIds = body.trailIds as string[];
    }
    const visibility =
      body && (body.visibility === 'private' || body.visibility === 'sharable')
        ? body.visibility
        : undefined;
    try {
      const topic = await registry.createTopic({
        title,
        ...(description !== undefined ? { description } : {}),
        ...(trailIds !== undefined ? { trailIds } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
      });
      broadcastTopicEvent(TopicAPIEvent.TOPIC_ADDED, topic);
      const trails = await resolveTopicTrails(topic, trailStore);
      res.status(201).json({ success: true, topic, trails });
    } catch (err) {
      console.error('[topicRoutes] create failed', err);
      res
        .status(500)
        .json({ success: false, error: 'failed to create topic' });
    }
  });

  // List all local topics as lightweight summaries so a briefed agent can
  // *discover* topics, not just fetch one it was handed by id. Deliberately
  // payload-free (no description body, no trail resolution) — it's a directory,
  // not a detail view; callers GET /api/topics/:id for the full topic + trails.
  // Sorted newest-updated first. Supports `?q=` for a case-insensitive
  // substring filter over title + description.
  app.get('/api/topics', async (req: Request, res: Response) => {
    try {
      const topics = await registry.getTopics();
      const q =
        typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const summaries = topics
        .filter((t) => {
          if (!q) return true;
          const hay = `${t.title}\n${t.description ?? ''}`.toLowerCase();
          return hay.includes(q);
        })
        .map((t) => ({
          id: t.id,
          href: `/api/topics/${encodeURIComponent(t.id)}`,
          title: t.title,
          descriptionPreview: descriptionPreview(t.description),
          trailCount: t.trailIds.length,
          state: t.status?.state,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      res.json({ success: true, topics: summaries, count: summaries.length });
    } catch (err) {
      console.error('[topicRoutes] list failed', err);
      res.status(500).json({ success: false, error: 'failed to list topics' });
    }
  });

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

  // Open a topic in the running app. The topic analogue of the trail activate
  // route (`POST /api/file-city/trail/activate`): a briefed terminal can ask
  // the app to surface a topic it just authored or linked. Unlike the
  // `TOPIC_*` registry broadcasts (which fan out to every window), this targets
  // a single window — whichever one the user currently has focused — and asks
  // its renderer to open the topic as a tab. The Topics-view handler lives in
  // the principal window, so when the focused window can't host it the resolver
  // falls back to focusing/creating the principal window.
  app.post('/api/topics/:id/activate', async (req: Request, res: Response) => {
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
      const target = await focusedOrMainWindow();
      if (!target || target.window.isDestroyed()) {
        res.json({ success: true, delivered: 0, windowOpened: 'none' });
        return;
      }
      const payload: TopicActivateEvent = {
        topicId: topic.id,
        title: topic.title,
      };
      target.window.webContents.send(TopicAPIEvent.TOPIC_ACTIVATE, payload);
      res.json({ success: true, delivered: 1, windowOpened: 'focused' });
    } catch (err) {
      console.error('[topicRoutes] activate failed', err);
      res
        .status(500)
        .json({ success: false, error: 'failed to activate topic' });
    }
  });

  // Validate the file/doc references embedded in a topic's description. Runs
  // the pure reference classifier (which links must be purl-qualified, scope
  // against the topic's repos, inline-code that should be links) plus an
  // existence check on each purl file-ref (local clone first, remote default
  // branch as fallback). Returns a severity ladder — `error` (non-purl repo
  // links, malformed purls), `finding` (missing / out-of-scope / unresolvable),
  // `suggestion` (convert inline code) — so the caller decides what blocks vs.
  // nudges. Read-only; it never edits the topic.
  app.post(
    '/api/topics/:id/validate-links',
    async (req: Request, res: Response) => {
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
        const topicRepoPurls = await collectTopicRepoPurls(topic, trailStore);
        const report = await validateTopicLinks(topic.description ?? '', {
          topicRepoPurls,
        });
        res.json({ success: true, topicId: id, ...report });
      } catch (err) {
        console.error('[topicRoutes] validate-links failed', err);
        res
          .status(500)
          .json({ success: false, error: 'failed to validate topic links' });
      }
    },
  );
}
