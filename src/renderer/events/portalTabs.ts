/**
 * Portal tab contract — the tab interfaces shared across the Projects / Inbox /
 * Topics workspace surfaces.
 *
 * `SharedTrailTab`, `LocalTrailTab`, and `MarkdownDocTab` were historically
 * declared 2–3× (once per framework) with identical shapes. They're defined
 * once here so the surfaces — and the unified `WorkspaceTab` union (see
 * docs/portal-unification.md, Increment 3) — share a single definition.
 *
 * The Inbox/Topics landing + topic tab types (`InboxHomeTab`, `TopicTab`,
 * `TopicsHomeTab`, `LocalTopicTab`) live here too now that the persistent
 * `WorkspaceShell` (not the retired per-view frameworks) renders them.
 */
import type {
  BaseTab,
  TerminalTab,
} from '@industry-theme/xterm-terminal-panel';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  GithubRepository,
  Purl,
} from '@principal-ai/alexandria-core-library';
import type { ActivityCommit } from '../hooks/useActivityFeed';
import type { StarredCollection } from '../../shared/tipc/webAdeRouterTypes';

/**
 * Shared trail tab — a trail published to web-ade (e.g. opened from an inbox
 * row, a recently-visited row, or a pasted `…/trail/{id}` URL). NOT in the local
 * trail library; carries only the id, and the panel self-fetches the payload
 * (resolving owner/repo).
 */
export interface SharedTrailTab extends BaseTab {
  contentType: 'shared-trail';
  trailId: string;
  owner?: string;
  repo?: string;
}

/**
 * Local trail tab — a trail from the on-disk library, opened in-place (e.g. a
 * freshly authored trail). Carries only the id; the panel self-fetches the
 * payload + repositoryPath.
 */
export interface LocalTrailTab extends BaseTab {
  contentType: 'local-trail';
  trailId: string;
}

/**
 * Markdown document tab — a doc opened in-place from the Principal MCP Bridge
 * (POST /api/document/open). Carries the absolute file path + host repo; renders
 * via `MarkdownDocTabContent`.
 */
export interface MarkdownDocTab extends BaseTab {
  contentType: 'markdown-doc';
  filePath: string;
  repositoryPath?: string;
}

/**
 * Source file tab — a non-markdown code file opened from a doc link. Rendered
 * read-only via `SourceFileTabContent` / `PierreFileView`. Multi-instance,
 * keyed by absolute `filePath`.
 */
export interface SourceFileTab extends BaseTab {
  contentType: 'source-file';
  filePath: string;
}

/**
 * Media tab — an image/video opened from a doc link. Rendered via
 * `MediaTabContent` / `MediaViewerPanel`. Multi-instance, keyed by absolute
 * `filePath`.
 */
export interface MediaTab extends BaseTab {
  contentType: 'media';
  filePath: string;
}

/** Landing tab for the Inbox surface — a hint to pick a trail from the left. */
export interface InboxHomeTab extends BaseTab {
  contentType: 'inbox-home';
}

/**
 * Topic tab — a topic published to web-ade, opened from an inbox row. Carries
 * only the id; `TopicTabContent` self-fetches the topic brief.
 */
export interface TopicTab extends BaseTab {
  contentType: 'topic';
  topicId: string;
}

/** Landing tab for the Topics surface — a hint to pick a topic from the left. */
export interface TopicsHomeTab extends BaseTab {
  contentType: 'topics-home';
}

/**
 * Local topic tab — a topic from the on-disk topic store, opened from a left
 * panel row. Carries the id (the body self-fetches) plus the title for the tab
 * label / header.
 */
export interface LocalTopicTab extends BaseTab {
  contentType: 'local-topic';
  topicId: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Projects surface tab types
//
// Historically declared in `projects-view/ProjectsPanelFramework.tsx`; moved
// here so the Projects surface shares the one tab-type module ahead of folding
// into the persistent `WorkspaceShell` (docs/portal-unification.md, Increment
// 3b). The framework re-exports them for back-compat.
// ---------------------------------------------------------------------------

/** Commit review tab — displays the diff for a specific commit. */
export interface CommitReviewTab extends BaseTab {
  contentType: 'commit-review';
  repoPath: string;
  repoName: string;
  githubOwner?: string;
  githubRepoName?: string;
  commit: ActivityCommit;
}

/** Live activity tab — real-time presence and repository activity. */
export interface LiveActivityTab extends BaseTab {
  contentType: 'live-activity';
}

/** Activity feed tab — the main activity feed with repository cards. */
export interface ActivityFeedTab extends BaseTab {
  contentType: 'activity-feed';
}

/** In-progress tab — repositories with uncommitted working-tree changes. */
export interface InProgressActivityTab extends BaseTab {
  contentType: 'in-progress-activity';
}

/** Project info tab — repository details with heatmap and file city. */
export interface ProjectInfoTab extends BaseTab {
  contentType: 'project-info';
  purl: Purl;
  github?: GithubRepository;
  localEntry?: AlexandriaEntry;
}

/** User profile tab — user activity and profile information. */
export interface UserProfileTab extends BaseTab {
  contentType: 'user-profile';
  username: string;
  email?: string;
}

/** Organization profile tab — org activity and profile information. */
export interface OrgProfileTab extends BaseTab {
  contentType: 'org-profile';
  orgName: string;
}

/** Collection profile tab — a collection's repos and users. */
export interface CollectionProfileTab extends BaseTab {
  contentType: 'collection-profile';
  collection: StarredCollection;
}

/** Owner activity tab — a user/org's commit activity. */
export interface OwnerActivityTab extends BaseTab {
  contentType: 'owner-activity';
  login: string;
  accountType: 'User' | 'Organization';
}

/** Repo activity tab — a repository's commit activity. */
export interface RepoActivityTab extends BaseTab {
  contentType: 'repo-activity';
  owner: string;
  repo: string;
}

/**
 * File City guide tab — a standalone File City explorer for one repository,
 * separate from the RepositoryProfilePanel's embedded city. Carries the purl
 * and optional GitHub/local identity so the panel can self-fetch file trees
 * and line counts. This is the desktop counterpart to web-ade's
 * FileCityGuidePanel surface.
 */
export interface FileCityGuideTab extends BaseTab {
  contentType: 'file-city-guide';
  purl: Purl;
  github?: GithubRepository;
  localEntry?: AlexandriaEntry;
  /** README mode — mutually exclusive with {@link weekActive}. */
  readmeActive?: boolean;
  readmePath?: string;
  /** Week-commits mode — mutually exclusive with {@link readmeActive}. */
  weekActive?: boolean;
}

// ---------------------------------------------------------------------------
// Drawings surface tab type
// ---------------------------------------------------------------------------

/**
 * Drawing tab — an Excalidraw canvas for one `.excalidraw` file, opened from the
 * Drawings left-panel list. Carries the drawing id + absolute path; the body
 * (`DrawingTabContent`) self-loads the file and owns save. A brand-new unsaved
 * drawing uses a `new-<uuid>` sentinel `drawingId` and no `path` until first save.
 */
export interface DrawingTab extends BaseTab {
  contentType: 'drawing';
  drawingId: string;
  path?: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Skills surface tab type
// ---------------------------------------------------------------------------

/**
 * Skill detail tab — a singleton view of the currently-selected skill. The body
 * (`SkillDetailTabContent`) reads the selected skill + install config from the
 * Skills surface context, so the tab carries no per-skill data; selecting a
 * different skill in the left list just updates this one tab's label + content.
 */
export interface SkillTab extends BaseTab {
  contentType: 'skill';
}

/** Union of all tab types the Projects surface renders. */
export type FeedTab =
  | TerminalTab
  | CommitReviewTab
  | LiveActivityTab
  | ActivityFeedTab
  | InProgressActivityTab
  | ProjectInfoTab
  | UserProfileTab
  | OrgProfileTab
  | CollectionProfileTab
  | OwnerActivityTab
  | RepoActivityTab
  | FileCityGuideTab
  | SharedTrailTab
  | LocalTrailTab
  | MarkdownDocTab
  | SourceFileTab
  | MediaTab;
