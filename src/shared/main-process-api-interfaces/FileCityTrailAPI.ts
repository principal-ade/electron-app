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

/** IPC event names for File City trail operations. */
export enum FileCityTrailEvent {
  PAYLOAD_SET = 'file-city:trail:set',
  PAYLOAD_CLEARED = 'file-city:trail:cleared',
  GET_CURRENT = 'file-city:trail:get-current',
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
  SET_TRANSIENT = 'file-city:trail:set-transient',
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

export type TrailShareErrorCode =
  | 'NO_GITHUB_REMOTE'
  | 'NO_GITHUB_TOKEN'
  | 'PAYLOAD_NOT_FOUND'
  | 'MISSING_FILES_NEEDS_CONFIRM'
  | 'PAYLOAD_TOO_LARGE'
  | 'NO_REPO_ACCESS'
  | 'SHARE_NOT_FOUND'
  | 'SNIPPET_NOT_BAKED'
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

/** Renderer-facing API for the File City trail bus. */
export interface FileCityTrailAPI {
  /**
   * Returns the latest trail for the given repo path (or the default slot
   * if no path is supplied), or `null` if none has been set.
   */
  getCurrent: (repositoryPath?: string) => Promise<TrailPayload | null>;

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
    callback: (info: { repositoryPath?: string }) => void,
  ) => () => void;

  /**
   * List saved trails. With `repositoryPath`, filters to entries for that
   * repo (plus repo-agnostic entries). Without it, returns every entry.
   */
  list: (repositoryPath?: string) => Promise<{
    entries: TrailIndexEntry[];
    activeId: string | null;
  }>;

  /** Read a saved trail by id without activating it. */
  load: (id: string) => Promise<TrailPayload | null>;

  /** Mark a saved trail active for its repository and broadcast `PAYLOAD_SET`. */
  activate: (id: string) => Promise<void>;

  /** Permanently delete a saved trail from disk + manifest. */
  delete: (id: string) => Promise<void>;

  /** Subscribe to library changes (set / delete / activate). */
  onLibraryChanged: (
    callback: (info: { repositoryPath?: string }) => void,
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
   * Broadcast a payload to all open trail panels via PAYLOAD_SET without
   * persisting it. Used to preview a payload from web-ade without polluting
   * the local library.
   */
  setTransient: (payload: TrailPayload) => Promise<void>;
}
