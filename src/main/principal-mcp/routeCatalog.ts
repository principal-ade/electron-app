export type BridgeMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface BridgeRouteDocumentation {
  method: BridgeMethod;
  path: string;
  summary: string;
  query?: Record<string, string>;
  body?: Record<string, string>;
  parameters?: Record<string, string>;
  response: string;
  errors?: Record<string, string>;
  notes?: string[];
  example?: Record<string, unknown>;
}

interface BridgeRouteGroup {
  name: string;
  description: string;
  routes: BridgeRouteDocumentation[];
}

export const MAX_ROUTE_LOOKUPS = 100;

/** Max repos per POST /api/repos/clone request. */
export const MAX_CLONE_BATCH = 20;

const topicResponse = '{ success: true, topic }';
const unknownTopic = { '404': 'Unknown local topic id.' };
const noteLocation = {
  relativeFilePath:
    'string (required): document path relative to repositoryPath.',
  repositoryPath: 'string (optional): absolute local repository path.',
};
const processControlErrors = {
  '404': 'Unknown process or rejected lifecycle operation; inspect error.',
};

/**
 * Shared documentation for GET discovery and POST lookup. Coverage tests compare
 * these method/path pairs with the bridge's route registrations.
 */
export const bridgeRouteCatalog: BridgeRouteGroup[] = [
  {
    name: 'diagnostics',
    description:
      'Bridge health, category discovery, and endpoint documentation.',
    routes: [
      {
        method: 'GET',
        path: '/health',
        summary: 'Check that the intended bridge is running.',
        response: '{ status: "ok", timestamp, message, port }',
      },
      {
        method: 'GET',
        path: '/routes',
        summary: 'List every documented category and endpoint summary.',
        response:
          '{ service, port, groups: [{ name, description, routes: [{ method, path, summary }] }], lookup }',
        notes: ['Use POST /routes for full request/response contracts.'],
      },
      {
        method: 'POST',
        path: '/routes',
        summary:
          'Look up documentation for a batch of registered route patterns.',
        body: {
          routes: `Array<{ path: string, method?: string }> (required, 1-${MAX_ROUTE_LOOKUPS} entries). Use exact route patterns from GET /routes, without query strings or fragments. Method is case-insensitive; omit it to return all methods for the path.`,
        },
        response:
          '{ success: true, results: [{ request: { path, method? }, found, routes: [{ category, method, path, summary, query?, body?, parameters?, response, errors?, notes?, example? }], error? }] }',
        errors: { '400': 'Invalid body, entry, method, or batch size.' },
        notes: [
          'Results preserve request order. Unknown paths or method/path pairs return found: false with an error and empty routes, without failing other entries.',
          'Matches exact registered patterns (for example /api/topics/:id), not concrete IDs, URLs, prefixes, or globs. Lookup is read-only and never invokes the requested endpoints.',
        ],
        example: {
          routes: [
            { method: 'POST', path: '/api/topics' },
            { path: '/api/processes/:id/logs' },
          ],
        },
      },
    ],
  },
  {
    name: 'subsystem-models',
    description: 'Read local subsystem models as agent context.',
    routes: [
      {
        method: 'GET',
        path: '/api/subsystem-models/:id',
        summary:
          'Read a local subsystem model, including components and trails.',
        parameters: { id: 'Local stored subsystem model id.' },
        response: '{ success: true, model }',
        errors: {
          '404': 'Unknown or invalid local subsystem model.',
          '500': 'Failed to read subsystem model.',
        },
      },
    ],
  },
  {
    name: 'topics',
    description:
      'Create, search, read, edit, open, validate, and delete local topic briefs; attach repositories, subsystem models, C4 sketches, and related topics.',
    routes: [
      {
        method: 'GET',
        path: '/api/topics',
        summary: 'List or search lightweight local topic summaries.',
        query: {
          q: 'string (optional): case-insensitive substring of title or description.',
        },
        response:
          '{ success: true, topics: [{ id, href, title, descriptionPreview, state?, createdAt, updatedAt }], count }',
        notes: [
          'Sorted newest-updated first. Preview is at most 200 characters; GET /api/topics/:id returns the full description. Searches local topics, not published web topics.',
        ],
      },
      {
        method: 'POST',
        path: '/api/topics',
        summary:
          'Create a local Markdown brief with optional repository, model, sketch, drawing, and topic references.',
        body: {
          title: 'string (required): non-empty, trimmed title.',
          description: 'string (optional): Markdown brief.',
          repos:
            'string[] (optional): repository PURLs, resolved through GET /api/repos.',
          subsystemModels:
            'Array<{ modelId: string, trailIds?: string[] }> (optional): local model associations.',
          references:
            'Array<{ kind: "c4-sketch", sketchId: string } | { kind: "drawing", drawingId: string } | { kind: "topic", topicId: string }> (optional): attached C4 sketches, Excalidraw drawings, and related topics. IDs must be non-empty strings. A drawingId is the file name without ".excalidraw" under ~/.alexandria/drawings/.',
        },
        response: `201 ${topicResponse}`,
        errors: {
          '400': 'Missing title or malformed repos/subsystemModels/references.',
        },
        notes: [
          'ID and timestamps are generated by the registry. Model associations are local-only and do not travel on publish.',
          'This HTTP handler does not expose publishing, assets, status, or visibility updates.',
          'Reference IDs are trimmed and duplicate kind/id pairs are stored once, preserving first-seen order. Omit references for no attachments, or pass []. References and model associations use stable local IDs, not storage URLs; their targets are not existence-checked by this route.',
          'References are separate from Markdown links in description. The five right-rail reference types are repos, subsystemModels, C4 sketches, drawings, and related topics; the description is not a sixth attachment type.',
        ],
        example: {
          title: 'Investigate bridge',
          description: '## Goal\nUnderstand the local API.',
          repos: ['pkg:github/principal-ade/electron-app'],
          subsystemModels: [{ modelId: 'sg-123-abc' }],
          references: [
            { kind: 'c4-sketch', sketchId: 'c4s-123-abc' },
            {
              kind: 'drawing',
              drawingId: '0b6f7c1e-2a4d-4e8f-9c3b-1d2e3f4a5b6c',
            },
            { kind: 'topic', topicId: 'topic-123-related' },
          ],
        },
      },
      {
        method: 'GET',
        path: '/api/topics/:id',
        summary: 'Read a local topic, including its full Markdown description.',
        parameters: { id: 'Local topic id.' },
        response: '{ success: true, topic, revision: string }',
        errors: unknownTopic,
      },
      {
        method: 'PATCH',
        path: '/api/topics/:id',
        summary:
          'Update a local topic in place, preserving its ID and session links.',
        body: {
          expectedRevision:
            'string (required): opaque revision returned by GET /api/topics/:id.',
          title: 'string (optional): non-empty, trimmed title.',
          description:
            'string (optional): full replacement Markdown; an empty string clears it.',
          repos:
            'string[] (optional): replace repository PURLs; [] clears them.',
          subsystemModels:
            'Array<{ modelId: string, trailIds?: string[] }> (optional): replace local model associations; [] clears them.',
          references:
            'Array<{ kind: "topic", topicId: string } | { kind: "c4-sketch", sketchId: string } | { kind: "drawing", drawingId: string }> (optional): replace attachments; [] clears them.',
        },
        response: '{ success: true, topic, revision: string }',
        errors: {
          ...unknownTopic,
          '400':
            'Missing revision, empty patch, unsupported fields, or malformed field values.',
          '409':
            'Topic changed since it was read. Fetch it again and reapply edits; do not blindly retry with the new revision.',
        },
        notes: [
          'Omitted fields are preserved. At least one editable field is required. Publishing, assets, status, visibility, identity, and timestamp edits are not supported.',
          'Use description replacement to delete, reorder, rename, or disambiguate Markdown sections. Never delete and recreate a topic just to edit it, or bypass the API by writing its JSON file.',
          'Writes broadcast TOPIC_UPDATED to app windows. Read back the topic and verify requested changes before reporting completion.',
          'The revision check is serialized with updates in this app process; direct file writes and other app processes are not coordinated.',
        ],
        example: {
          expectedRevision: '<revision from GET>',
          title: 'Updated brief',
          description: '## Goal\nKeep the brief current.',
        },
      },
      {
        method: 'POST',
        path: '/api/topics/:id/description/append',
        summary: 'Append new context to the topic description.',
        body: { text: 'string (required): non-empty Markdown to append.' },
        response: topicResponse,
        errors: {
          ...unknownTopic,
          '400': 'Missing or empty text.',
          '409':
            'Topic changed while appending. Reread and reconcile before retrying.',
        },
        notes: [
          'Reads existing content and inserts a blank-line separator. Prefer section upsert when replacing status or findings.',
        ],
      },
      {
        method: 'POST',
        path: '/api/topics/:id/description/section',
        summary: 'Replace a Markdown section, or insert it when absent.',
        body: {
          heading:
            'string (required): exact non-empty heading text; leading # characters are optional.',
          body: 'string (required): non-empty replacement section body.',
          level: 'number (optional): heading level 2 or 3; defaults to 2.',
        },
        response: '{ success: true, topic, action: "replaced" | "inserted" }',
        errors: {
          ...unknownTopic,
          '400': 'Missing heading or body.',
          '409':
            'Multiple headings match, or the topic changed while editing. Reread; use a revision-checked PATCH to resolve duplicate headings.',
        },
        notes: [
          'Fetch the topic before editing. Replacement includes nested deeper subsections through the next heading at the same level.',
        ],
        example: { heading: 'Status', body: 'Reviewed and current.' },
      },
      {
        method: 'POST',
        path: '/api/topics/:id/activate',
        summary: 'Dispatch a request to open the topic as an app tab.',
        response:
          '{ success: true, delivered: 0 | 1, windowOpened: "none" | "existing" | "created" }',
        errors: unknownTopic,
        notes: [
          'Targets the focused app window when available; otherwise uses the existing main window or creates one hidden. Does not show, restore, or focus an existing window. windowOpened reports none, existing, or created. delivered: 1 means an event was sent, not a renderer acknowledgement.',
        ],
      },
      {
        method: 'POST',
        path: '/api/topics/:id/validate-links',
        summary:
          'Read-only validation of repository links in a topic description.',
        response: '{ success: true, topicId, summary, findings }',
        errors: unknownTopic,
        notes: [
          'Checks PURL-qualified references, declared repository scope, and file existence. May consult the remote default branch when a local check is unavailable. Does not edit the topic.',
        ],
      },
      {
        method: 'POST',
        path: '/api/topics/:id/subsystem-models',
        summary: 'Associate a local subsystem model, upserting by modelId.',
        body: {
          modelId: 'string (required): non-empty local stored model id.',
          trailIds:
            'string[] (optional): narrow the association to specific runtime flows.',
        },
        response: topicResponse,
        errors: {
          ...unknownTopic,
          '400': 'Missing modelId or invalid trailIds.',
          '409':
            'Topic changed while editing associations. Reread before retrying.',
        },
        notes: [
          'Replaces an existing association with the same modelId. Associations are local-only and do not travel on publish.',
        ],
      },
      {
        method: 'DELETE',
        path: '/api/topics/:id/subsystem-models/:modelId',
        summary: 'Remove a local subsystem-model association.',
        parameters: {
          id: 'Local topic id.',
          modelId: 'Local subsystem-model id.',
        },
        response: topicResponse,
        errors: {
          ...unknownTopic,
          '409':
            'Topic changed while editing associations. Reread before retrying.',
        },
        notes: ['Idempotent for an unlinked model on an existing topic.'],
      },
      {
        method: 'DELETE',
        path: '/api/topics/:id',
        summary:
          'Permanently delete a local topic and its local sync metadata.',
        response: '{ success: true, id }',
        errors: unknownTopic,
        notes: [
          'Not a remote publishing/deletion operation. Windows receive a topic-removed event.',
        ],
      },
    ],
  },
  {
    name: 'repos',
    description:
      'Open GitHub repository tabs; discover, clone, register, and de-register local Alexandria repositories and their PURLs.',
    routes: [
      {
        method: 'POST',
        path: '/api/repos/open',
        summary:
          'Open or focus the native GitHub repository explorer tab without cloning.',
        body: {
          repo: 'string (required): owner/repo, pkg:github/owner/repo, or https://github.com/owner/repo. Repository roots only; optional .git suffix and trailing slash.',
        },
        response:
          '{ success: true, delivered: boolean, purl, reason?: "no-focused-repository-host" }',
        errors: {
          '400': 'Missing, invalid, or unsupported repository identifier.',
          '403': 'Origin or Sec-Fetch-Site header present.',
          '500': 'Failed to dispatch the repository-open event.',
        },
        notes: [
          'Reuses the same native repository explorer as GitHub Quick Open results, not an embedded browser page. Works for remote-only and already-cloned GitHub repositories; never clones, registers, or forks.',
          'Requires an already-focused Principal MAIN window. Does not create or focus a window. Ask the user to focus MAIN when delivered is false.',
          'delivered: true means the event was sent, not a renderer acknowledgement or successful data load. The renderer reveals the workspace and opens or focuses a tab keyed by repository PURL.',
          'Only github.com repository roots are supported. Rejects other hosts, filesystem paths, credentials, query strings, fragments, and subpaths such as /issues or /tree/main. GitHub data uses the app’s existing authentication and network access.',
        ],
        example: { repo: 'https://github.com/TimBroddin/gitstatus' },
      },
      {
        method: 'GET',
        path: '/api/repos',
        summary: 'List registered local repository identities.',
        response:
          '{ success: true, repos: [{ path, name, remoteUrl?, purl?, registeredAt }] }',
        notes: [
          'Use the returned PURL, not a filesystem path, in topic repos.',
        ],
      },
      {
        method: 'POST',
        path: '/api/repos/clone',
        summary:
          'Clone one or more repos into the base directory convention and register them.',
        body: {
          repos: `string[] (required unless body.repo is set): 1-${MAX_CLONE_BATCH} repo identifiers. Accepts repo PURLs (pkg:github/owner/repo), owner/repo slugs, and clone URLs (https, ssh://, git@host:owner/repo.git).`,
          repo: 'string (optional): a single identifier, shorthand for repos: [repo].',
          depth:
            'number (optional): shallow clone depth; omit for full history.',
          register:
            'boolean (optional, default true): register each clone in the Alexandria registry.',
        },
        response:
          '{ success: true|false, baseDirectory, results: [{ request, ok, action?: "cloned"|"alreadyRegistered", path?, cloneUrl?, repo?: RepoSummary, registerError?, error? }], summary: { requested, cloned, alreadyRegistered, failed } }',
        errors: {
          '400':
            'Missing/empty repos, more than the batch limit, or no base directory configured.',
          '500': 'Could not read the base directory.',
        },
        notes: [
          'Clones land at <baseDefaultDirectory>/<owner>/<repo>, the same convention the app enforces; get the base directory from GET /api/repos via summary.baseDirectory or set it in Settings → General.',
          'Results preserve request order and one entry failing does not abort the others; success is true only when every entry reported ok. Clone failures come back per entry in error, so retry only those.',
          'Paths that already exist on disk but are not registered are reported as failures rather than overwritten. Targets already registered are reported as alreadyRegistered with no network call.',
          'Clones are long-running; the request holds until they finish (5-minute internal timeout per clone). Use depth: 1 for large repos.',
          'Local-only repos are not clonable — register existing checkouts with POST /api/repos instead.',
        ],
        example: {
          repos: ['pkg:github/principal-ai/skills', 'acme/web'],
          depth: 1,
        },
      },
      {
        method: 'POST',
        path: '/api/repos',
        summary: 'Register a Git repository by absolute local path.',
        body: {
          path: 'string (required): absolute path with a .git directory or file (including worktrees).',
          remoteUrl:
            'string (optional): override the origin remote derived from Git.',
        },
        response:
          '201 (new) or 200 (existing) { success: true, alreadyRegistered, repo: { path, name, remoteUrl?, purl?, registeredAt, hasViews, viewCount, github? } }',
        errors: {
          '400': 'Missing/relative path or no Git repository at path.',
        },
        notes: [
          'Re-registering an existing path is idempotent and returns the existing entry.',
        ],
        example: { path: '/absolute/path/to/repo' },
      },
      {
        method: 'DELETE',
        path: '/api/repos',
        summary:
          'Remove a repository registration, optionally deleting the checkout.',
        query: {
          path: 'string (required unless body.path is supplied): absolute registered path; query form is preferred.',
          deleteLocal:
            'boolean (optional, default false): also delete the working tree on disk. Requires an absolute path that is a git working tree.',
        },
        body: {
          path: 'string (optional): alternative to query path.',
          deleteLocal: 'boolean (optional): alternative to query deleteLocal.',
        },
        response: '{ success: true, deleteLocal, removed: RepoSummary }',
        errors: {
          '400':
            'Missing path; or deleteLocal requested for a relative path, a non-git directory, a filesystem root, or the base directory.',
          '404': 'No repository registered at path.',
        },
        notes: [
          'Default behavior only removes the registry entry; the checkout stays on disk.',
          'deleteLocal: true deletes the directory. It is refused unless the path is registered, absolute, a git working tree, and not / , $HOME, or the base directory.',
        ],
      },
    ],
  },
  {
    name: 'dependency-graph',
    description:
      'Find direct cross-repository dependents among analyzed local clones.',
    routes: [
      {
        method: 'GET',
        path: '/api/repos/blast-radius',
        summary:
          'Find direct dependents of packages published by a target repository.',
        query: {
          repo: 'string: owner/name or repo name (one selector required).',
          path: 'string: absolute repository path (alternative selector).',
          purl: 'string: published package PURL (alternative selector).',
          includeSelf:
            '"true" (optional): keep packages from the target repository.',
          refresh: '"true" (optional): rebuild the index before querying.',
        },
        response:
          '{ success: true, scope: "direct-dependents", target: { repoPath, repoName?, purls }, impacted: [{ purl, repoPath, name, dependsOn }], unanalyzedCount }',
        errors: {
          '400': 'Missing selector or relative path.',
          '404': 'No analyzed repository matched.',
        },
        notes: [
          'Direct dependents only, not transitive or all of GitHub. Supply one selector; precedence if multiple are supplied is path, purl, repo. unanalyzedCount indicates incomplete coverage.',
        ],
      },
    ],
  },
  {
    name: 'dependencies',
    description: 'Resolve a dependency using repository-monitoring context.',
    routes: [
      {
        method: 'POST',
        path: '/dependencies/resolve',
        summary:
          'Resolve a dependency to a registered clone or package information.',
        body: {
          dependencyId: 'string (required): dependency identifier.',
          repositoryRoot: 'string (optional): local repository context.',
        },
        response:
          '{ success: true, found, alexandriaEntry?, packageInfo?, suggestions? }',
        errors: {
          '400': 'Missing dependencyId (message field).',
          '500': 'Resolution failure (message and optional error fields).',
        },
        notes: [
          'success means the operation completed; inspect found to determine whether a dependency was located.',
        ],
        example: {
          dependencyId: '@principal-ai/subsystems-core',
          repositoryRoot: '/absolute/path/to/repo',
        },
      },
    ],
  },
  {
    name: 'document-notes',
    description:
      'Read and write text-anchored note overlays without editing document source.',
    routes: [
      {
        method: 'GET',
        path: '/api/document-notes',
        summary: 'List notes for one document.',
        query: noteLocation,
        response: '{ success: true, repositoryPath?, relativeFilePath, notes }',
        errors: { '400': 'Missing relativeFilePath.' },
        notes: [
          'Notes are keyed by repository/document pair. Without repositoryPath, storage is repo-agnostic. Use the same location fields for all operations on a note.',
        ],
      },
      {
        method: 'GET',
        path: '/api/document-notes/library',
        summary:
          'List documents with notes, optionally limited to one repository.',
        query: {
          repositoryPath:
            'string (optional): absolute repository path; omit to list all.',
        },
        response:
          '{ success: true, entries: [{ repositoryPath, relativeFilePath, fileHash, noteCount, updatedAt, sizeBytes }] }',
      },
      {
        method: 'POST',
        path: '/api/document-notes',
        summary: 'Create a text-anchored document note.',
        body: {
          ...noteLocation,
          body: 'string (required): non-empty Markdown note.',
          anchor:
            '{ exact: string, prefix?: string, suffix?: string } (required): exact must be non-empty and match document text.',
          author:
            'string (optional): agents should explicitly use an identifiable agent name.',
        },
        response: '{ success: true, note }',
        errors: { '400': 'Missing document path/body or malformed anchor.' },
        notes: [
          'Keep anchor.exact within one paragraph, heading, or list item; cross-block anchors may not render.',
          'Always set author for agent-created notes to avoid fallback attribution to the user. Notes are overlays, not document edits.',
        ],
        example: {
          repositoryPath: '/absolute/path/to/repo',
          relativeFilePath: 'README.md',
          anchor: { exact: 'Getting started' },
          body: 'Review setup steps.',
          author: 'Droid',
        },
      },
      {
        method: 'PATCH',
        path: '/api/document-notes/:noteId',
        summary: 'Update a note body, preserving its anchor.',
        body: {
          ...noteLocation,
          body: 'string (required): replacement body; empty string is allowed.',
        },
        response: '{ success: true, note }',
        errors: {
          '400': 'Missing document path or non-string body.',
          '404': 'Unknown note in the specified document.',
        },
        notes: [
          'Use the same repositoryPath and relativeFilePath as creation. To change the anchor, delete and recreate the note.',
        ],
      },
      {
        method: 'DELETE',
        path: '/api/document-notes/:noteId',
        summary: 'Delete a note from the specified document.',
        query: noteLocation,
        response: '{ success: true }',
        errors: {
          '400': 'Missing relativeFilePath.',
          '404': 'Unknown note in the specified document.',
        },
      },
    ],
  },
  {
    name: 'documents',
    description:
      'Dispatch document-open requests to the focused document-capable window, falling back to the principal window.',
    routes: [
      {
        method: 'POST',
        path: '/api/document/open',
        summary:
          'Open a document tab in the focused MAIN or Dev Workspace window, or in the principal window when neither is focused.',
        body: {
          filePath:
            'string (required): absolute path, or relative path when repositoryPath is supplied.',
          repositoryPath:
            'string (optional): repository root for resolving a relative filePath and providing context.',
          createIfMissing:
            'boolean (optional, default false): create the file and any missing parent directories when it does not exist. Never overwrites an existing file.',
          range:
            'object (optional): { startLineNumber, startColumn, endLineNumber, endColumn }. Positive 1-based integers; end is exclusive and must not precede start. Opens text source at this span.',
        },
        response: '{ success: true, windowOpened: boolean, created: boolean }',
        errors: {
          '400':
            'Missing filePath, relative filePath without repositoryPath, invalid range, non-boolean createIfMissing, or filePath resolves to a directory.',
          '500': 'File creation failed (permissions, read-only volume).',
        },
        notes: [
          'Prefers the focused MAIN or Dev Workspace window. Otherwise focuses the principal window (creating one if needed) and opens there; windowOpened: false only when no window could be resolved.',
          'windowOpened: true means dispatch to a qualifying window, not renderer acknowledgement or successful document load. The active renderer view must host a document listener.',
          'created: true only when createIfMissing was set and the file did not exist. A missing file without createIfMissing still dispatches the tab, which then renders a not-found state.',
          'Creation is independent of window focus: a request can return windowOpened: false with created: true.',
          'A range opens markdown as source rather than rendered prose. Existing source tabs are focused and navigated without discarding edits. Writable local source uses Monaco; read-only source uses Pierre with line-level highlighting. Ranges do not apply to media.',
        ],
        example: {
          filePath: 'src/index.ts',
          repositoryPath: '/absolute/path/to/repo',
          range: {
            startLineNumber: 10,
            startColumn: 1,
            endLineNumber: 15,
            endColumn: 2,
          },
        },
      },
    ],
  },
  {
    name: 'pull-requests',
    description:
      'Keep the user informed about GitHub pull requests: add a PR to the Home watch list, which the app polls for checks, review, and merge state.',
    routes: [
      {
        method: 'GET',
        path: '/api/pull-requests/watch',
        summary: 'List watched pull requests with their latest snapshots.',
        response: '{ success: true, pullRequests: WatchedPullRequest[] }',
        notes: [
          'Each entry has id (owner/repo#number), url, title, author, state (open | closed | merged), draft, headSha, mergeable, checks { status, total, passed, failed, pending }, review (none | pending | approved | changes_requested), and addedAt/updatedAt/lastPolledAt timestamps.',
        ],
      },
      {
        method: 'POST',
        path: '/api/pull-requests/watch',
        summary:
          'Watch a pull request so Home shows its status and the user is notified on changes.',
        body: {
          pr: 'string (required): https://github.com/owner/repo/pull/123, owner/repo#123, or owner/repo/pull/123.',
        },
        response:
          '201 { success: true, pullRequest: WatchedPullRequest, alreadyWatched: false } or 200 with alreadyWatched: true',
        errors: {
          '400': 'Missing or unrecognised pr reference.',
          '403': 'Origin or Sec-Fetch-Site header present.',
          '404':
            'The pull request could not be loaded (unknown, private without access, or GitHub unreachable), or the watch list is full.',
        },
        notes: [
          'Intended for the user, not the agent: the app polls GitHub about once a minute, lists the PR in Home with a link to open it in the browser, and raises a desktop notification when checks finish, a review is decided, or the PR is merged or closed. Do not poll this route to wait for CI.',
          'Watching an already-watched PR refreshes it and returns the current snapshot. Merged and closed PRs stay listed for a day, then drop off automatically.',
          'Uses the app’s existing GitHub authentication (OAuth token or gh CLI); private repositories require access.',
        ],
        example: {
          pr: 'https://github.com/principal-ade/electron-app/pull/42',
        },
      },
      {
        method: 'DELETE',
        path: '/api/pull-requests/watch/:owner/:repo/:number',
        summary: 'Stop watching a pull request.',
        response: '{ success: true }',
        errors: {
          '400': 'number is not a positive integer.',
          '403': 'Origin or Sec-Fetch-Site header present.',
          '404': 'The pull request is not being watched.',
        },
      },
    ],
  },
  {
    name: 'processes',
    description:
      'Start, inspect, stop, restart, and remove app-owned managed processes.',
    routes: [
      {
        method: 'GET',
        path: '/api/processes',
        summary:
          'List the managed process registry, not externally detected servers.',
        response: '{ success: true, processes: ProcessEntry[] }',
        notes: [
          'Entries include id, label, command, cwd, kind, status, origin, and optional repo, pid, port, timing, exit/error, and runCount information. Use durable id, not PID. The UI merges detected servers separately.',
        ],
      },
      {
        method: 'POST',
        path: '/api/processes',
        summary: 'Start a managed process inside a registered repository.',
        body: {
          command:
            'string (required): command binary, not a shell command string.',
          cwd: 'string (required): absolute path inside a registered repository.',
          args: 'string[] (optional): command arguments.',
          env: 'Record<string, string> (optional): environment overrides.',
          label: 'string (optional): display label.',
          kind: '"dev-server" | "watcher" | "task" | "agent" | "script" (optional).',
        },
        response: '201 { success: true, process }',
        errors: {
          '400':
            'Invalid command/cwd, command not allowlisted, cwd outside registered repositories, or start failure.',
        },
        notes: [
          'Allowed command basenames: npm, pnpm, yarn, bun, npx, node, deno, tsx, tsc, vite, next, astro, nuxt, storybook, http-server, vitest, jest, python, python3, uv, go, cargo, make, ruby, bundle, php, composer, dotnet, docker.',
          'The app owns the process. Closing a panel or tab never stops it. Start success does not imply server readiness; the port is learned from process output.',
        ],
        example: {
          command: 'npm',
          args: ['run', 'dev'],
          cwd: '/absolute/path/to/repo',
          label: 'Dev server',
          kind: 'dev-server',
        },
      },
      {
        method: 'PATCH',
        path: '/api/processes/:id',
        summary: 'Set the display name shown for a managed process in Home.',
        body: { label: 'string (required): non-empty display name.' },
        response: '{ success: true }',
        errors: {
          '400': 'body.label is missing, empty, or whitespace-only.',
          '404': 'Unknown managed process id.',
          '500':
            'Could not securely save the display name for a pinned process.',
        },
        notes: [
          'The new label appears in the Home process list and is retained when the process is restarted. Pinned processes save the updated label with their launch configuration.',
        ],
        example: { label: 'Frontend dev server' },
      },
      {
        method: 'GET',
        path: '/api/processes/:id/logs',
        summary: 'Read captured stdout/stderr as text.',
        response: '{ success: true, id, logs: string }',
        errors: { '404': 'Unknown process id.' },
      },
      {
        method: 'POST',
        path: '/api/processes/:id/stop',
        summary:
          'Stop a managed process, escalating SIGTERM to SIGKILL if necessary.',
        response: '{ success: true }',
        errors: processControlErrors,
      },
      {
        method: 'POST',
        path: '/api/processes/:id/restart',
        summary:
          'Restart a managed process using its original command and durable id.',
        response: '{ success: true, process }',
        errors: processControlErrors,
        notes: [
          'The old port is cleared until the restarted process reports a new one.',
        ],
      },
      {
        method: 'DELETE',
        path: '/api/processes/:id',
        summary: 'Remove a process entry that is not running.',
        response: '{ success: true }',
        errors: processControlErrors,
        notes: ['Stop a running process separately before removal.'],
      },
    ],
  },
  {
    name: 'builds',
    description:
      'Author and inspect agent-authored build configurations: what command runs, which repo and revision it builds, and which secret names it needs. Secret values never cross the bridge.',
    routes: [
      {
        method: 'GET',
        path: '/api/build-configurations',
        summary: 'List build configuration summaries, most-recent-first.',
        response:
          '{ success: true, configs: [{ id, name, repo, status, updatedAt }] }',
      },
      {
        method: 'POST',
        path: '/api/build-configurations',
        summary: 'Create a build configuration. Always created unconfirmed.',
        body: {
          name: 'string (required): display name.',
          repo: 'string (required): pkg:github/<owner>/<repo>. Exactly one repo.',
          checkout:
            'object (optional): { path?: string|null, ref, depth, reset }. path null means <baseDefaultDirectory>/<owner>/<repo>; ref is a branch, tag, or sha; reset is ff-only | clean | none.',
          command:
            'object (required): { line, cwd, timeoutMs }. line is a single shell line whose binary must be allowlisted; cwd is repo-relative.',
          secrets:
            'Array<{ env, label, required }> (optional): secret env var names, never values.',
        },
        response: '201 { success: true, config }',
        errors: {
          '400':
            'Invalid body, validation failure (see issues), or a smuggled secretConfirmation.',
        },
        notes: [
          'The bridge can never confirm secrets; confirmation happens in the app after a human reviews the exact content. IDs and timestamps are generated by the store.',
          'checkout.path must be null or an absolute path. Null resolves under the builds directory (never the general clone tree); runs refuse when no builds directory is set.',
        ],
        example: {
          name: 'web build',
          repo: 'pkg:github/acme/web',
          checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' },
          command: { line: 'npm run build', cwd: '.', timeoutMs: 900000 },
          secrets: [
            { env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true },
          ],
        },
      },
      {
        method: 'GET',
        path: '/api/build-configurations/:id',
        summary: 'Read a full build configuration.',
        parameters: { id: 'Local build configuration id.' },
        response: '{ success: true, config }',
        errors: { '404': 'Unknown build configuration id.' },
      },
      {
        method: 'PATCH',
        path: '/api/build-configurations/:id',
        summary:
          'Patch a build configuration. Material edits clear the secret confirmation.',
        body: {
          name: 'string (optional): replacement display name.',
          checkout:
            'object (optional): deep-merged checkout fields (path, ref, depth, reset).',
          command:
            'object (optional): deep-merged command fields (line, cwd, timeoutMs).',
          secrets:
            'Array<{ env, label, required }> (optional): replaces the secret list.',
        },
        response: '{ success: true, config }',
        errors: {
          '400':
            'Non-object patch, id change, validation failure, or a smuggled secretConfirmation.',
          '404': 'Unknown build configuration id.',
        },
        notes: [
          'The bridge cannot confirm secrets. Editing repo, ref, command line, or secret names clears the stored confirmation, so runs need a fresh human review.',
        ],
      },
      {
        method: 'DELETE',
        path: '/api/build-configurations/:id',
        summary: 'Permanently delete a build configuration.',
        response: '{ success: true, id }',
        errors: { '404': 'Unknown build configuration id.' },
        notes: ['Deleting a config does not delete granted secret values.'],
      },
      {
        method: 'GET',
        path: '/api/build-configurations/:id/preflight',
        summary:
          'Check whether a config is ready to run: secrets confirmed, granted, repo registered, binary allowlisted.',
        response:
          '{ success: true, configId, ready, checks: { confirmed, missingSecrets: string[], repoRegistered, binaryAllowed } }',
        errors: { '404': 'Unknown build configuration id.' },
        notes: [
          'ready is true only when every check passes. missingSecrets names required env names with no grant; values are never returned.',
        ],
      },
      {
        method: 'POST',
        path: '/api/build-configurations/:id/request-secrets',
        summary:
          'Ask the app to surface the secret grant UI for the missing secrets.',
        response:
          '{ success: true, configId, missing: string[], requested: boolean }',
        errors: { '404': 'Unknown build configuration id.' },
        notes: [
          'requested is true when a secret surface consumed the request. Until the secret-setting surface subscribes, tell the user the missing names directly.',
        ],
      },
      {
        method: 'POST',
        path: '/api/build-configurations/:id/run',
        summary: 'Start a build run in a visible terminal session.',
        response:
          '201 { success: true, runId, configId, terminalSessionId, status: "running" }',
        errors: {
          '400':
            'Config not confirmed, command no longer allowlisted, repo not registered, no checkout path with no builds directory, or checkout missing on disk.',
          '404': 'Unknown build configuration id.',
          '409':
            'Required secrets are not granted (missing names), or no live application window to own the terminal.',
          '501': 'Run collaborators are not wired (never in the app).',
        },
        notes: [
          'Secrets resolve into the PTY spawn environment, never the typed command line. The tab shows the bare command plus a wrapper reporting completion via OSC 7501.',
          'The run tracks the session to succeeded/failed/timed-out; poll GET /api/build-runs/:id. A run outliving the config timeout is marked timed-out and its session destroyed.',
          'After completion, the terminal stays open for the app-wide Build Terminal Cleanup delay (Settings → General; defaults to five minutes), then its idle PTY is destroyed.',
        ],
        example: {},
      },
      {
        method: 'GET',
        path: '/api/build-runs',
        summary: 'List retained build runs, most-recent-first.',
        response:
          '{ success: true, runs: [{ runId, configId, terminalSessionId, status, exitCode?, startedAt, endedAt? }] }',
        notes: [
          'Use a returned runId with GET /api/build-runs/:id or /api/build-runs/:id/output. Run history is in-memory and cleared when the app restarts; finished records are evicted as needed to bound retention.',
        ],
        errors: {
          '501': 'Build run listing is not available in this app build.',
        },
      },
      {
        method: 'GET',
        path: '/api/build-runs/:id',
        summary: 'Poll a build run for terminal status.',
        response:
          '{ success: true, run: { runId, configId, terminalSessionId, status, exitCode?, startedAt, endedAt? } }',
        errors: {
          '404': 'Unknown build run id.',
        },
        notes: [
          'Run records are in-memory; an app restart drops run history while the terminal tab itself may survive.',
        ],
      },
      {
        method: 'GET',
        path: '/api/build-runs/:id/output',
        summary: 'Read a sanitized, bounded output tail for a build run.',
        query: {
          tailBytes:
            'Optional integer from 1 to 65536; defaults to 20480 bytes.',
        },
        response:
          '{ success: true, runId, terminalSessionId, output, bytesReturned, truncated }',
        errors: {
          '400': 'tailBytes is not an integer in the supported range.',
          '404': 'Unknown build run id.',
          '409':
            'Output is unavailable or the current secret grants cannot safely redact it.',
          '501': 'Build output snapshots are not wired in this app build.',
        },
        notes: [
          'Only tracked build-run terminals are readable; arbitrary terminal scrollback is not exposed.',
          'ANSI/control sequences are removed and the run secret values are re-resolved and redacted before output crosses the bridge.',
          'Resolving values for redaction writes the existing names-only secret audit record; secret values never cross the bridge.',
          'A sanitized output snapshot remains readable after the terminal closes, until the in-memory run record is evicted or the app restarts. The PTY buffer may already have been trimmed by the terminal scrollback limit.',
        ],
      },
    ],
  },
  {
    name: 'agent-sessions',
    description:
      'Browse recent coding-agent session summaries and resume a supported session in a new terminal tab.',
    routes: [
      {
        method: 'GET',
        path: '/api/agent-sessions',
        summary:
          'List or search recent Claude Code, OpenCode, or Cursor sessions scoped to registered repositories.',
        query: {
          agent: 'string (required): opencode, claude, or cursor.',
          directory:
            'string (optional): absolute directory inside a registered repository; narrows the results. OpenCode lists sessions from this project context.',
          q: 'string (optional): title/content search; provider-specific history search is used.',
        },
        response:
          '{ success: true, agent, sessions: [{ agent, id, title, directory, createdAt, updatedAt, resumable }] }',
        errors: {
          '400':
            'Unsupported agent or directory outside registered repositories.',
          '403': 'Browser-origin requests are not allowed.',
          '500': 'Session history could not be read.',
        },
        notes: [
          'Without directory, OpenCode is queried across registered repositories; Claude Code and Cursor history is filtered to registered repository paths.',
          'This returns summaries, not full transcripts or event streams. Cursor entries can be non-resumable when Cursor has no supported CLI resume target.',
        ],
      },
      {
        method: 'POST',
        path: '/api/agent-sessions/open',
        summary:
          'Validate a session and resume it in a new terminal tab in the focused Principal MAIN window.',
        body: {
          agent: 'string (required): opencode, claude, or cursor.',
          sessionId:
            'string (required): provider session ID from the list response.',
          directory:
            'string (required): absolute session directory from the list response, inside a registered repository.',
        },
        response: '{ success: true, opened: boolean, sessionId, reason? }',
        errors: {
          '400':
            'Malformed request or directory outside registered repositories.',
          '403': 'Browser-origin requests are not allowed.',
          '404': 'Session is unknown or not in a registered repository.',
          '409': 'The provider reports that this session cannot be resumed.',
          '500': 'The session could not be prepared or dispatched.',
        },
        notes: [
          'The app constructs a provider-specific CLI resume command from the validated session ID; callers cannot supply a command.',
          'The new terminal tab uses the session title as its display name and carries the agent ID separately for provider-specific icons.',
          'A short startup overlay identifies the resumed provider and is dismissed on first terminal output or by a timeout.',
          'A new terminal tab is created; the previous shell process and scrollback are not restored.',
          'opened is true only after the renderer acknowledges that it materialized the terminal tab. No focused MAIN window or no acknowledgement returns opened: false.',
        ],
        example: {
          agent: 'opencode',
          sessionId: 'ses_1234567890',
          directory: '/absolute/path/to/repo',
        },
      },
    ],
  },
  {
    name: 'terminals',
    description:
      'Open, list, and close real PTY terminal sessions. Uses the renderer\u2019s own session-creation path, so reuse, ownership, and telemetry match a terminal opened in the UI.',
    routes: [
      {
        method: 'GET',
        path: '/api/terminals',
        summary: 'List live terminal sessions.',
        response: '{ success: true, sessions: TerminalSession[] }',
        notes: [
          'Entries include id, cwd, context, createdAt, and lastActivity. Sessions include ones reattached from the PTY daemon after an app restart.',
        ],
      },
      {
        method: 'POST',
        path: '/api/terminals',
        summary:
          'Open a terminal session at a repository, or reattach to the one this context already owns.',
        body: {
          cwd: 'string (required): absolute path inside a registered repository.',
          context:
            'string (optional): tab identity. Re-posting the same context returns the existing session with reused: true instead of spawning a second shell.',
          command:
            'string (optional): command to run in the new session. A command request always creates a fresh session.',
        },
        response:
          '{ success: true, sessionId, reused: boolean, windowId: number }',
        errors: {
          '400':
            'cwd missing, not absolute, missing on disk, outside a registered repository, or session creation failed.',
          '409': 'No live application window to own the terminal.',
        },
        notes: [
          'Served by the same code path as the renderer, so it emits terminal.session.create with session.origin = http.',
        ],
      },
      {
        method: 'DELETE',
        path: '/api/terminals/:id',
        summary: 'Close a terminal session and kill its PTY.',
        response: '{ success: true, sessionId }',
        errors: { '404': 'Unknown session id.' },
      },
      {
        method: 'GET',
        path: '/api/terminals/:id/status',
        summary:
          'Poll a terminal session for liveness and OSC 7501 program status.',
        response:
          '{ success: true, sessionId, alive, programStatus: ProgramStatusRecord[], lastActivity }',
        errors: { '404': 'Unknown session id.' },
        notes: [
          'programStatus carries the terminal-owned OSC 7501 records (states idle/working/done/blocked/error); a live session with no reports returns []. Poll this instead of scraping scrollback.',
        ],
      },
    ],
  },
  {
    name: 'requests',
    description:
      'Prepare editable HTTP request tabs for explicit user sending.',
    routes: [
      {
        method: 'POST',
        path: '/api/requests/open',
        summary:
          'Remember a prepared HTTP route and open it in the focused Principal MAIN window. Never sends it.',
        body: {
          title:
            'string (optional): 1–200 characters; defaults to HTTP request.',
          request:
            'BrunoRequest (required): http: { method, url }, optional meta, headers, params, body, auth. Each header/param has name, value, enabled; params also have type query or path.',
          environment:
            'Record<string, string> (optional): explicit {{variable}} replacements.',
          repositoryPath:
            'string (optional): absolute originating repository path; distinct from the request target.',
          target:
            '{ purl: string, identifier: string } (optional): unverified UI grouping only. Trimmed, non-empty strings; purl at most 1000 characters, identifier at most 200. No registry lookup or C4 verification.',
        },
        response:
          '{ success: true, opened, tabId?, reason?: "no-focused-request-host" | "request-host-unavailable" }',
        errors: {
          '400': 'Invalid, oversized, or unsupported definition.',
          '403': 'Origin or Sec-Fetch-Site header present.',
          '503':
            'Encrypted route retention unavailable, corrupt storage, or catalog full.',
        },
        notes: [
          'Opening and reopening never send HTTP. Only the user Send button executes a request. No scripts, tests, response capture, or auto-send flags.',
          'Requires an already-focused Principal MAIN window. Does not create/focus windows. opened acknowledges a committed tab, not a network response; waits up to three seconds.',
          'HTTP/HTTPS URLs, headers, query/path parameters, JSON/text/XML/urlencoded bodies, basic/bearer auth. Multipart definitions can be edited and pinned but Send rejects them. File uploads are not supported.',
          'Valid preparations are retained in an encrypted route catalog, even without Send or a focused host. Identity: exact target pair, uppercase method, URL origin/path; literal URL templates are not resolved. Query/body/header/environment/title changes update the existing definition, not a send-history row. Literal IDs are not generalized into route patterns.',
          'Pins are favorites, not a retention requirement. Unpinning keeps the definition. Save changes explicitly after editing any remembered request. Already-open tabs retain their current edits/responses; closed tabs reopen from the latest retained definition. Responses and execution history are never persisted.',
          'Requests and Home group by exact target.purl then target.identifier, with missing targets under Ungrouped. Metadata never changes the URL, permissions, or execution. The catalog holds 1000 entries without silent eviction; unpin then Forget in Requests to remove a definition. No plaintext fallback.',
        ],
        example: {
          title: 'Health check',
          target: {
            purl: 'pkg:github/acme/backend',
            identifier: 'container:api',
          },
          request: {
            http: { method: 'GET', url: 'http://localhost:3000/health' },
          },
        },
      },
    ],
  },
  {
    name: 'browser',
    description:
      'Open localhost preview tabs in an already-focused Principal MAIN window.',
    routes: [
      {
        method: 'POST',
        path: '/api/browser/open',
        summary:
          'Open or reuse a localhost browser tab, optionally linked to a managed process.',
        body: {
          url: 'string: http://localhost:<explicit-port>/path; exactly one of url or processId is required.',
          processId: 'string: managed process id; mutually exclusive with url.',
          path: 'string (optional, only with processId): path/query/fragment starting with a single /; defaults to /.',
          label: 'string (optional): display label.',
        },
        response:
          '{ success: true, opened, tabId?, processId?, reason?: "no-focused-browser-host" | "browser-host-unavailable" }',
        errors: {
          '400': 'Invalid target.',
          '403': 'Origin or Sec-Fetch-Site header present.',
          '404': 'Unknown managed process.',
          '409': 'Process not running or without a known port.',
        },
        notes: [
          'Requires an already-focused MAIN window, not Dev Workspace. Does not create/focus windows or start servers.',
          'Only HTTP, literal localhost, explicit ports 1-65535, and no credentials. Rejects HTTPS, 127.0.0.1, remote hosts, whitespace, backslashes, and control characters.',
          'Call from an agent tool, not browser-page JavaScript. Subsequent navigation/redirects are not sandboxed by initial URL validation.',
          'opened: true means the renderer committed a tab, not that the page loaded. Waits up to three seconds. On opened: false inspect reason; ask the user to focus MAIN for no-focused-browser-host.',
          'Process-linked tabs follow restarts and port changes. URL-only tabs associate only when exactly one running managed process matches the port. Reopening reloads and resets history. Closing never stops a process.',
        ],
        example: {
          processId: '<managed-process-id>',
          path: '/docs',
          label: 'Preview',
        },
      },
    ],
  },
  {
    name: 'theme',
    description: 'Inspect theme schemas and update theme preferences.',
    routes: [
      {
        method: 'GET',
        path: '/theme/schema',
        summary: 'Read the theme schema and available themes.',
        query: {
          theme:
            'string (optional): theme name; defaults to user-selected theme.',
        },
        response:
          '{ success: true, themeName, schema, availableThemes, ...themeSchema }',
        errors: { '404': 'Target theme not found.' },
      },
      {
        method: 'POST',
        path: '/theme/update',
        summary:
          'Update a schema-supported theme property and broadcast changes.',
        body: {
          propertyPath:
            'string (required): schema-supported dotted path, such as colors.primary.',
          value: 'required, non-null: value for the property.',
          themeName: 'string (optional): target theme.',
        },
        response:
          '{ success: true, themeName?, activeTheme?, warning?, ...updateResult }',
        errors: {
          '400': 'Missing propertyPath/value or unsupported property path.',
          '500': 'Theme handler update failed.',
        },
        notes: [
          'Fetch GET /theme/schema first. Updates persisted preferences and broadcasts to renderers.',
        ],
      },
    ],
  },
  {
    name: 'bruno',
    description:
      'Validate Bruno request content/files/collections or parse content to JSON; does not execute requests.',
    routes: [
      {
        method: 'POST',
        path: '/api/bruno/validate',
        summary: 'Validate Bruno request content.',
        body: { content: 'string (required): non-empty .bru content.' },
        response:
          '{ success: true, valid, errors, warnings, ...validationResult }',
        errors: { '400': 'Missing content.' },
        notes: [
          'HTTP 200 / success: true can still mean valid: false. Inspect validation diagnostics. Does not execute the request.',
        ],
      },
      {
        method: 'POST',
        path: '/api/bruno/validate/file',
        summary: 'Validate a local Bruno request file.',
        body: { filePath: 'string (required): absolute local .bru file path.' },
        response:
          '{ success: true, filePath, valid, errors, warnings, ...validationResult }',
        errors: { '400': 'Missing filePath.' },
        notes: [
          'Inspect valid, not just success. Does not execute the request.',
        ],
      },
      {
        method: 'POST',
        path: '/api/bruno/validate/collection',
        summary: 'Validate an entire local Bruno collection.',
        body: {
          collectionPath: 'string (required): absolute local collection path.',
        },
        response:
          '{ success: true, valid, totalFiles, validFiles, invalidFiles, results, ...collectionResult }',
        errors: { '400': 'Missing collectionPath.' },
        notes: [
          'Inspect valid and per-file results. Does not execute requests.',
        ],
      },
      {
        method: 'POST',
        path: '/api/bruno/parse',
        summary: 'Parse Bruno request content to JSON.',
        body: { content: 'string (required): non-empty .bru content.' },
        response: '{ success: true, request }',
        errors: {
          '400': 'Missing content (error) or parse failure (errors array).',
        },
        notes: ['Parsing does not execute the request.'],
      },
    ],
  },
];
