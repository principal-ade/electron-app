/**
 * Portal intents — the view-agnostic "open this content" events that flow on a
 * panel event bus from left panels / tab content to the single tab host that
 * turns them into tabs.
 *
 * Part of the portal-unification work (see docs/portal-unification.md): emitters
 * fire these intents instead of calling a view-specific tabs context directly,
 * so one listener can later subsume the per-view tab contexts. The names live in
 * a `const` map (not bare string literals) so a mistyped intent fails to compile
 * rather than silently never matching.
 */
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  GithubRepository,
  Purl,
} from '@principal-ai/alexandria-core-library';
import type { RepositorySelectedPayload } from './repositorySelected';
import type { StarredCollection } from '../../shared/tipc/webAdeRouterTypes';

export const PORTAL_INTENTS = {
  /** Open a topic as a tab. */
  topicOpen: 'topic:open',
  /** Open a markdown document as a tab. */
  docOpen: 'doc:open',
  /** Open a repository profile tab. */
  repositorySelected: 'repository:selected',
  /** Open a File City guide tab (the guide host, separate from the profile). */
  repositoryGuideOpen: 'repository:guide-open',
  /** Open a File City guide tab with README active (or toggle it off). */
  repositoryGuideOpenReadme: 'repository:guide-open-readme',
  /** Open a File City guide tab with week-commits mode active (or toggle it off). */
  repositoryGuideOpenWeek: 'repository:guide-open-week',
  /** Open a user/org profile tab (collapses the legacy `user:profile-selected`). */
  ownerSelected: 'owner:selected',
  /** Open a collection profile tab. */
  collectionSelected: 'collection:selected',
  /** Open the live-activity tab. */
  liveActivityOpen: 'live-activity:open',
  /** Open an owner (user/org) commit-activity tab. */
  ownerActivityRequested: 'owner:activity-requested',
  /** Open a repository commit-activity tab. */
  repositoryActivityRequested: 'repository:activity-requested',
  /** Open a terminal tab rooted at a local directory. */
  terminalOpen: 'terminal:open',
  /** Open a local subsystem model in a workspace tab. */
  subsystemModelOpen: 'subsystem-model:open',
} as const;

export type PortalIntentName =
  (typeof PORTAL_INTENTS)[keyof typeof PORTAL_INTENTS];

/** Payload for {@link PORTAL_INTENTS.topicOpen}. */
export interface TopicOpenPayload {
  topicId: string;
  title?: string;
}

/** Payload for {@link PORTAL_INTENTS.subsystemModelOpen}. */
export interface SubsystemModelOpenPayload {
  modelId: string;
  title: string;
}

/** Emit a {@link PORTAL_INTENTS.subsystemModelOpen} intent. */
export function emitSubsystemModelOpen(
  events: PanelEventEmitter,
  source: string,
  payload: SubsystemModelOpenPayload,
): void {
  events.emit<SubsystemModelOpenPayload>({
    type: PORTAL_INTENTS.subsystemModelOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/** Payload for {@link PORTAL_INTENTS.docOpen}. */
export interface DocOpenPayload {
  filePath: string;
  repositoryPath?: string;
}

/** Emit a {@link PORTAL_INTENTS.topicOpen} intent. */
export function emitTopicOpen(
  events: PanelEventEmitter,
  source: string,
  payload: TopicOpenPayload,
): void {
  events.emit<TopicOpenPayload>({
    type: PORTAL_INTENTS.topicOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/** Emit a {@link PORTAL_INTENTS.docOpen} intent. */
export function emitDocOpen(
  events: PanelEventEmitter,
  source: string,
  payload: DocOpenPayload,
): void {
  events.emit<DocOpenPayload>({
    type: PORTAL_INTENTS.docOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}

// ---------------------------------------------------------------------------
// Projects-surface open intents
//
// The Projects surface opens a richer set of tabs (repo / owner / collection
// profiles, activity tabs). Unlike Topics — whose left panel emits topic
// intents straight onto the portal bus — the Projects panels (left panel
// AND persistent tab content) emit these on their single local `events` prop,
// mixed with genuine intra-surface chatter (refresh, profile-link, commit-review
// overlay). `installProjectsOpenForwarder` is the typed boundary that lifts just
// the open-intent subset onto the portal bus, where `PortalIntentBridge`
// materializes them — keeping the chatter local and the panels convention-clean.
// ---------------------------------------------------------------------------

/** Re-exported for the bridge: {@link PORTAL_INTENTS.repositorySelected} payload. */
export type { RepositorySelectedPayload };

/**
 * Payload for {@link PORTAL_INTENTS.ownerSelected}. Collapses the legacy
 * `user:profile-selected` (a `feed:`-era straggler) and `owner:selected`
 * (`{ owner, isOrg }`) into one intent discriminated by `kind`.
 */
export interface OwnerSelectedPayload {
  owner: string;
  kind: 'user' | 'org';
  /** Email hint carried by the legacy `user:profile-selected` path. */
  email?: string;
}

/** Payload for {@link PORTAL_INTENTS.collectionSelected}. */
export interface CollectionSelectedPayload {
  collection: StarredCollection;
}

/** Payload for {@link PORTAL_INTENTS.ownerActivityRequested}. */
export interface OwnerActivityRequestedPayload {
  login: string;
  accountType: 'User' | 'Organization';
}

/** Payload for {@link PORTAL_INTENTS.repositoryActivityRequested}. */
export interface RepositoryActivityRequestedPayload {
  owner: string;
  repo: string;
}

/** Payload for {@link PORTAL_INTENTS.terminalOpen}. */
export interface TerminalOpenPayload {
  /** Absolute local directory the terminal should start in. */
  directory: string;
  /** Optional tab label (defaults to the directory's basename). */
  label?: string;
}

/** Emit a {@link PORTAL_INTENTS.terminalOpen} intent. */
export function emitTerminalOpen(
  events: PanelEventEmitter,
  source: string,
  payload: TerminalOpenPayload,
): void {
  events.emit<TerminalOpenPayload>({
    type: PORTAL_INTENTS.terminalOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/** Emit a {@link PORTAL_INTENTS.repositoryGuideOpen} intent. */
export function emitRepositoryGuideOpen(
  events: PanelEventEmitter,
  source: string,
  payload: RepositorySelectedPayload,
): void {
  events.emit<RepositorySelectedPayload>({
    type: PORTAL_INTENTS.repositoryGuideOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/** Payload for {@link PORTAL_INTENTS.repositoryGuideOpenReadme}. */
export interface RepositoryGuideOpenReadmePayload {
  purl: Purl;
  github?: GithubRepository;
  localEntry?: AlexandriaEntry;
  readmeActive: boolean;
  readmePath?: string;
}

/** Emit a {@link PORTAL_INTENTS.repositoryGuideOpenReadme} intent. */
export function emitRepositoryGuideOpenReadme(
  events: PanelEventEmitter,
  source: string,
  payload: RepositoryGuideOpenReadmePayload,
): void {
  events.emit<RepositoryGuideOpenReadmePayload>({
    type: PORTAL_INTENTS.repositoryGuideOpenReadme,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/** Payload for {@link PORTAL_INTENTS.repositoryGuideOpenWeek}. */
export interface RepositoryGuideOpenWeekPayload {
  purl: Purl;
  github?: GithubRepository;
  localEntry?: AlexandriaEntry;
  weekActive: boolean;
}

/** Emit a {@link PORTAL_INTENTS.repositoryGuideOpenWeek} intent. */
export function emitRepositoryGuideOpenWeek(
  events: PanelEventEmitter,
  source: string,
  payload: RepositoryGuideOpenWeekPayload,
): void {
  events.emit<RepositoryGuideOpenWeekPayload>({
    type: PORTAL_INTENTS.repositoryGuideOpenWeek,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/**
 * Forward the Projects open-intent subset from a panel's local bus onto the
 * portal bus, normalizing the two legacy owner events into one
 * {@link PORTAL_INTENTS.ownerSelected}. Pure data-sync / overlay chatter
 * (`*-profile:open-link`, the `commit:review-selected` overlay,
 * `repository:opened/deleted`, `repository-profile:*`) is intentionally NOT
 * forwarded — it stays on the local bus.
 *
 * Returns an unsubscribe function.
 */
export function installProjectsOpenForwarder(
  local: PanelEventEmitter,
  portal: PanelEventEmitter,
): () => void {
  const forward = (type: string) => {
    const handler = (event: { source?: string; payload?: unknown }) => {
      portal.emit({
        type,
        source: event.source ?? 'projects-open-forwarder',
        timestamp: Date.now(),
        payload: event.payload as never,
      });
    };
    local.on(type, handler);
    return () => local.off(type, handler);
  };

  // Pass-through opens (payload unchanged).
  const unsubs = [
    forward(PORTAL_INTENTS.repositorySelected),
    forward(PORTAL_INTENTS.repositoryGuideOpen),
    forward(PORTAL_INTENTS.repositoryGuideOpenReadme),
    forward(PORTAL_INTENTS.repositoryGuideOpenWeek),
    forward(PORTAL_INTENTS.collectionSelected),
    forward(PORTAL_INTENTS.liveActivityOpen),
    forward(PORTAL_INTENTS.ownerActivityRequested),
    forward(PORTAL_INTENTS.repositoryActivityRequested),
  ];

  // owner:selected — normalize `{ owner, isOrg }` → `{ owner, kind }`.
  const onOwnerSelected = (event: {
    source?: string;
    payload: { owner: string; isOrg: boolean };
  }) => {
    portal.emit<OwnerSelectedPayload>({
      type: PORTAL_INTENTS.ownerSelected,
      source: event.source ?? 'projects-open-forwarder',
      timestamp: Date.now(),
      payload: {
        owner: event.payload.owner,
        kind: event.payload.isOrg ? 'org' : 'user',
      },
    });
  };
  local.on(PORTAL_INTENTS.ownerSelected, onOwnerSelected);
  unsubs.push(() => local.off(PORTAL_INTENTS.ownerSelected, onOwnerSelected));

  // Legacy user:profile-selected → owner:selected{ kind: 'user' }.
  const onUserProfileSelected = (event: {
    source?: string;
    payload: { username: string; email?: string };
  }) => {
    portal.emit<OwnerSelectedPayload>({
      type: PORTAL_INTENTS.ownerSelected,
      source: event.source ?? 'projects-open-forwarder',
      timestamp: Date.now(),
      payload: {
        owner: event.payload.username,
        kind: 'user',
        email: event.payload.email,
      },
    });
  };
  local.on('user:profile-selected', onUserProfileSelected);
  unsubs.push(() => local.off('user:profile-selected', onUserProfileSelected));

  return () => unsubs.forEach((u) => u());
}
