/**
 * File City Trail API
 *
 * Pushes trail payloads from external callers (HTTP) to the File City Trail
 * Explorer panel in the renderer, where they are rendered with the upstream
 * `FileCityTrailExplorerPanel` component.
 *
 * Trails are an authored-walkthrough medium — see `docs/TRAIL_DESIGN.md`
 * in `@industry-theme/file-city-panel` for the design. The renderer-
 * facing surface talks in `TrailPayload` / `TrailNote` shapes from that
 * upstream package.
 *
 * Trail payloads are deliberately portable — they never carry filesystem
 * paths. The host (electron) keeps `repositoryPath` on the index entry
 * only; the payload itself stays clean so a trail authored on machine A
 * renders on machine B.
 */

import type {
  TrailPayload,
  TrailNote,
  TrailNoteDraft,
  BaseTrailIndexEntry,
} from '@industry-theme/file-city-panel';

/**
 * Mirror of upstream `TrailPurpose` (defined in `@industry-theme/file-city-panel`'s
 * `Trail.d.ts` but not re-exported from its package index). Kept in sync by
 * convention — the union is stable per the upstream docs.
 */
export type TrailPurpose = 'investigation' | 'changelog' | 'informative';

/** IPC event names for File City trail operations. */
export enum FileCityTrailEvent {
  PAYLOAD_SET = 'file-city:trail:set',
  PAYLOAD_CLEARED = 'file-city:trail:cleared',
  LIBRARY_CHANGED = 'file-city:trail:library-changed',
  LIST = 'file-city:trail:list',
  LOAD = 'file-city:trail:load',
  ACTIVATE = 'file-city:trail:activate',
  DELETE = 'file-city:trail:delete',
  NOTE_CREATE = 'file-city:trail:note-create',
  NOTE_UPDATE = 'file-city:trail:note-update',
  NOTE_DELETE = 'file-city:trail:note-delete',
  SHARE = 'file-city:trail:share',
  LIST_SHARED = 'file-city:trail:list-shared',
  FETCH_SHARED = 'file-city:trail:fetch-shared',
  FETCH_SHARED_BY_ID = 'file-city:trail:fetch-shared-by-id',
  SET_TRANSIENT = 'file-city:trail:set-transient',
  SHOW_IN_PRINCIPAL = 'file-city:trail:show-in-principal',
}

/** Envelope for `SHOW_IN_PRINCIPAL` IPC — tells the principal window to
 *  surface the given trail (switch to TrailsView). Cold starts use the
 *  `#openTrailId=` URL hash instead; this event is for warm-start handoff. */
export interface TrailShowInPrincipalEnvelope {
  trailId: string;
}

/**
 * Manifest entry for a saved trail. Extends the portable `BaseTrailIndexEntry`
 * with electron-specific fields needed for repo-scoped library views and
 * payload→file-on-disk resolution.
 */
export interface TrailIndexEntry extends BaseTrailIndexEntry {
  /**
   * Filesystem path the trail was authored in. Host-private — not part of
   * the portable trail schema. Used by the persistence layer to bucket
   * payloads by repo and to feed the renderer's "trails for this repo"
   * picker.
   */
  repositoryPath?: string;
  /**
   * Trail id this entry was forked from (typically an investigation that
   * was converted to an informative trail). Host-private — the portable
   * payload doesn't carry it. The fork-informative route stamps this.
   */
  derivedFrom?: string;
  /**
   * Number of distinct files the trail touches — counted by deduping
   * `marker.sourcePath` across the payload at index time. Optional so
   * legacy index entries written before this field existed still parse;
   * they'll be backfilled on next save.
   */
  fileCount?: number;
  /**
   * Mirrors `payload.purpose` so list views can color cards by kind
   * without reading the payload. `undefined` means the payload had no
   * declared purpose — per the upstream schema, consumers treat that as
   * `'investigation'`.
   */
  purpose?: TrailPurpose;
  /**
   * Number of sign-offs (`payload.signOffs.length`). Lets list views show
   * an informative trail's verified-vs-unverified state without reading
   * the payload. `undefined` on legacy entries; treat as 0 (unverified).
   */
  signOffCount?: number;
  /**
   * ISO timestamp the trail was published to web-ade. Its presence marks
   * the trail as "shared & locked": the local copy is retained but content
   * edits (re-POSTs through `save`) are rejected. `undefined` means the
   * trail is a local draft that can still be edited. Host-private — not
   * part of the portable payload.
   */
  sharedAt?: string;
  /**
   * Public web-ade URL for the shared trail, captured at publish time.
   * Lets the row render a "copy link" affordance after reload without the
   * ephemeral renderer-session share map. Set iff `sharedAt` is set.
   */
  sharedUrl?: string;
}

/**
 * Shared-trail manifest entry returned by web-ade. Replaces the on-disk
 * `TrailIndexEntry`'s filesystem coupling with the GitHub identity that
 * uploaded the record.
 */
export interface SharedTrailIndexEntry extends BaseTrailIndexEntry {
  createdBy: { githubId: number; githubLogin: string };
  /** GitHub numeric repo id at upload time, used as a rename-stable backstop. */
  githubRepoId: number;
}

export interface FileCityTrailShareResult {
  url: string;
  id: string;
  entry: SharedTrailIndexEntry;
}

export interface TrailListSharedResult {
  origin: { owner: string; repo: string };
  entries: SharedTrailIndexEntry[];
}

export interface FileCityTrailFetchSharedResult {
  entry: SharedTrailIndexEntry;
  payload: TrailPayload;
}

/**
 * Result of a by-id shared-trail fetch. Unlike `fetchShared`, the caller
 * supplies only the trail id — web-ade resolves the owning `{owner, repo}`
 * server-side (from its id→repo pointer) and gates on the viewer's GitHub
 * repo access. The owner/repo are echoed back so the renderer can resolve a
 * local clone (or, when absent, fall back to opening the trail in a browser).
 */
export interface FileCityTrailFetchSharedByIdResult {
  owner: string;
  repo: string;
  payload: TrailPayload;
  entry?: SharedTrailIndexEntry;
}

export type TrailShareErrorCode =
  | 'NO_GITHUB_REMOTE'
  | 'NO_GITHUB_TOKEN'
  | 'PAYLOAD_NOT_FOUND'
  | 'MISSING_FILES_NEEDS_CONFIRM'
  | 'PAYLOAD_TOO_LARGE'
  | 'NO_REPO_ACCESS'
  | 'SHARE_NOT_FOUND'
  | 'SNIPPET_NOT_BAKED'
  | 'INVALID_PAYLOAD'
  | 'NETWORK_ERROR'
  | 'WEB_ADE_ERROR';

/**
 * Typed error thrown by `share` / `listShared` / `fetchShared`. Lives in the
 * shared package so renderer code can `instanceof`-discriminate without
 * importing from main. The preload layer rehydrates this from the IPC
 * `{ ok: false, code, message, details? }` envelope.
 */
export class TrailShareError extends Error {
  public readonly code: TrailShareErrorCode;
  public readonly details?: unknown;

  constructor(
    code: TrailShareErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'TrailShareError';
    this.code = code;
    this.details = details;
  }
}

export type TrailShareEnvelope<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: TrailShareErrorCode;
      message: string;
      details?: unknown;
    };

export interface TrailShareOptions {
  owner?: string;
  repo?: string;
  /**
   * Repo path the share is for. Required when the renderer can't infer it
   * from the index entry (`entry.repositoryPath` may be absent for
   * repo-agnostic trails).
   */
  repositoryPath?: string;
  /** Confirmation retry after `MISSING_FILES_NEEDS_CONFIRM`. */
  allowMissing?: boolean;
}

export interface TrailListSharedOptions {
  owner?: string;
  repo?: string;
  /** Required when the renderer doesn't already have owner/repo in scope. */
  repositoryPath?: string;
}

export type { TrailPayload, TrailNote, TrailNoteDraft, BaseTrailIndexEntry };

/**
 * Envelope broadcast on PAYLOAD_SET. Wraps the portable payload with the
 * host-private `repositoryPath` so renderers can bucket without that
 * field leaking into the trail schema.
 */
export interface TrailPayloadSetEnvelope {
  payload: TrailPayload;
  repositoryPath?: string;
}

/**
 * Envelope broadcast on PAYLOAD_CLEARED. Emitted when a saved trail is
 * deleted; renderers compare `id` against their currently-shown payload
 * and self-clear when it matches.
 */
export interface TrailPayloadClearedEnvelope {
  id: string;
  repositoryPath?: string;
}

/** Renderer-facing API for the File City trail bus. */
export interface FileCityTrailAPI {
  /**
   * Subscribe to "payload set" events. The envelope carries both the
   * portable trail payload and the host-private `repositoryPath` so
   * subscribers can bucket by repo. Returns an unsubscribe function.
   */
  onPayloadSet: (
    callback: (envelope: TrailPayloadSetEnvelope) => void,
  ) => () => void;

  /** Subscribe to "payload cleared" events. Returns an unsubscribe function. */
  onPayloadCleared: (
    callback: (envelope: TrailPayloadClearedEnvelope) => void,
  ) => () => void;

  /**
   * List saved trails. With `repositoryPath`, filters to entries for that
   * repo (plus repo-agnostic entries). Without it, returns every entry.
   */
  list: (repositoryPath?: string) => Promise<{
    entries: TrailIndexEntry[];
  }>;

  /** Read a saved trail by id without activating it. */
  load: (id: string) => Promise<TrailPayload | null>;

  /**
   * Resolve a saved trail by id, returning the payload + repo path so the
   * calling renderer can show it locally and emit an in-window renderer
   * event. No persisted state is mutated; cross-window notification is
   * the HTTP /activate route's job (it broadcasts PAYLOAD_SET).
   */
  activate: (
    id: string,
  ) => Promise<{ payload: TrailPayload; repositoryPath?: string } | null>;

  /**
   * Permanently delete a saved trail from disk + manifest. Returns whether
   * the entry was found and the repo path so the calling renderer can
   * update local state directly.
   */
  delete: (id: string) => Promise<{
    found: boolean;
    repositoryPath?: string;
  }>;

  /** Subscribe to library changes (set / delete / activate). */
  onLibraryChanged: (
    callback: (info: { repositoryPath?: string }) => void,
  ) => () => void;

  /**
   * Subscribe to "show this trail in the principal window" events. Fires
   * when the bridge routes a trail to the principal window on warm start
   * (the dev-workspace for the repo isn't open). The principal window
   * should switch to TrailsView. Returns an unsubscribe function.
   */
  onShowInPrincipal: (
    callback: (envelope: TrailShowInPrincipalEnvelope) => void,
  ) => () => void;

  /**
   * Create a note on the active trail. Returns the persisted note (with
   * server-assigned id + timestamps).
   */
  createNote: (
    payloadId: string,
    draft: TrailNoteDraft,
  ) => Promise<TrailNote>;

  /** Update a note's body. */
  updateNote: (
    payloadId: string,
    noteId: string,
    body: string,
  ) => Promise<TrailNote>;

  /** Delete a note. */
  deleteNote: (payloadId: string, noteId: string) => Promise<void>;

  /**
   * Publish a saved trail to web-ade. Bakes diff-snippet `newContents` from
   * disk before posting. Throws `TrailShareError` for typed failures.
   */
  share: (
    id: string,
    options?: TrailShareOptions,
  ) => Promise<FileCityTrailShareResult>;

  /**
   * List shared trails for the current repo. Returns an empty array (not an
   * error) for the no-remote / no-token / no-shares cases so the panel can
   * render without an error affordance.
   */
  listShared: (
    options?: TrailListSharedOptions,
  ) => Promise<TrailListSharedResult>;

  /** Hydrate a single shared trail by id. Throws on 404. */
  fetchShared: (
    owner: string,
    repo: string,
    id: string,
  ) => Promise<FileCityTrailFetchSharedResult>;

  /**
   * Hydrate a shared trail by id alone — no owner/repo required. web-ade
   * resolves the owning repo server-side and gates on GitHub access.
   * Used by the titlebar to open a pasted `…/trail/{id}` URL. Throws on
   * 404 / no-access.
   */
  fetchSharedById: (id: string) => Promise<FileCityTrailFetchSharedByIdResult>;

  /**
   * Push a payload to renderer trail panels for a specific repo via
   * `PAYLOAD_SET`, without persisting it. Used to preview a payload
   * fetched from web-ade without polluting the local library. The
   * `repositoryPath` argument scopes the push to that repo's windows.
   */
  setTransient: (
    payload: TrailPayload,
    repositoryPath: string | undefined,
  ) => Promise<void>;
}
