/**
 * File City Sequence Diagram API
 *
 * Pushes sequence-diagram payloads from external callers (HTTP) to the
 * File City panel in the renderer, where they are rendered as a
 * collapsible overlay on top of the city.
 */

import type {
  SequenceEvent,
  SequenceEdge,
} from '@principal-ai/principal-view-react';

/**
 * IPC event names for File City sequence-diagram operations
 */
export enum FileCitySequenceEvent {
  PAYLOAD_SET = 'file-city:sequence-diagram:set',
  PAYLOAD_CLEARED = 'file-city:sequence-diagram:cleared',
  GET_CURRENT = 'file-city:sequence-diagram:get-current',
  LIBRARY_CHANGED = 'file-city:sequence-diagram:library-changed',
  LIST = 'file-city:sequence-diagram:list',
  LOAD = 'file-city:sequence-diagram:load',
  ACTIVATE = 'file-city:sequence-diagram:activate',
  DELETE = 'file-city:sequence-diagram:delete',
  NOTE_CREATE = 'file-city:sequence-diagram:note-create',
  NOTE_UPDATE = 'file-city:sequence-diagram:note-update',
  NOTE_DELETE = 'file-city:sequence-diagram:note-delete',
}

/**
 * Default snippet variant — reads `event.sourcePath` and renders a single-file
 * window. `kind` may be omitted for back-compat; missing `kind` is treated as
 * `'slice'`.
 */
export interface SliceSnippet {
  kind?: 'slice';
  /** First line of the snippet (1-based, inclusive). */
  startLine: number;
  /** Last line of the snippet (1-based, inclusive). */
  endLine: number;
  /** Line to highlight as the focus point; defaults to `startLine`. */
  focusLine?: number;
  /** Lines of context above/below the snippet; defaults to 2. */
  contextLines?: number;
}

/**
 * Diff snippet variant — renders a before/after view inline. Used by code-
 * review walkthroughs where each event represents a change region in a PR.
 */
export interface DiffSnippet {
  kind: 'diff';
  /** Pre-change file contents (full file or a pre-sliced window). */
  oldContents: string;
  /**
   * Post-change file contents. When omitted, the renderer reads the current
   * contents at `event.sourcePath` and diffs against `oldContents`.
   */
  newContents?: string;
  /** Optional snippet window (1-based) applied to both sides before diffing. */
  startLine?: number;
  endLine?: number;
  /** Line in the post-change window to call out (1-based). */
  focusLine?: number;
  /** Lines of unchanged context kept around the window; defaults to 2. */
  contextLines?: number;
  /** Pierre rendering style. Defaults to `'unified'`. */
  diffStyle?: 'unified' | 'split';
}

export type SequenceEventSnippet = SliceSnippet | DiffSnippet;

/**
 * Augmented sequence event used by File City. Adds an optional
 * `snippet` reference on top of the upstream `SequenceEvent` shape.
 */
export type FileCitySequenceEventDef = SequenceEvent & {
  snippet?: SequenceEventSnippet;
  /**
   * Optional human-readable description of the change/event. Surfaced in
   * the left-edge explainer overlay when the event is selected — useful for
   * code-review walkthroughs where each event needs a "why" alongside the
   * snippet.
   */
  description?: string;
};

/**
 * Layout options forwarded to `<SequenceDiagramRenderer>`. Currently surfaces
 * the subset that callers tend to want for narrative authoring; extend this
 * bucket as more upstream `UseSequenceLayoutOptions` knobs prove useful.
 */
export interface SequenceLayoutOptions {
  /**
   * Resolved namespaces in left-to-right order. Listed lanes are placed
   * first; any unlisted lanes (including ones that materialize after a
   * drill-down) fall back to first-event order behind them. Unknown entries
   * are ignored, so callers can safely list namespaces that may not be
   * present in every dataset.
   *
   * Without this option, lane order follows the order events first appear
   * in `payload.events` (as of `@principal-ai/principal-view-react@0.15.9`).
   */
  laneOrder?: string[];
}

/**
 * Payload accepted by `POST /api/file-city/sequence` and broadcast to
 * all renderer windows. Re-exports `SequenceEvent`/`SequenceEdge` from
 * `@principal-ai/principal-view-react` so callers reference one shape.
 */
export interface SequenceDiagramPayload {
  /**
   * Stable id for the payload. Assigned server-side when not supplied.
   * Used as the storage key and for activate/delete operations.
   */
  id?: string;
  /** Optional title shown in the drawer header */
  title?: string;
  /**
   * Optional repo path; renderer hooks filter by this so a payload
   * targets only the matching File City panel when several are open.
   */
  repositoryPath?: string;
  /**
   * Optional markdown summary of the whole flow. Surfaced in the left-edge
   * overlay when no event is selected; per-event `description` takes over
   * once the user picks an event.
   */
  summary?: string;
  /** Events in display order */
  events: FileCitySequenceEventDef[];
  /** Edges between events */
  edges: SequenceEdge[];
  /** Renderer layout knobs (lane ordering, etc.). */
  layoutOptions?: SequenceLayoutOptions;
  /** ISO 8601 timestamp set on first persist. */
  createdAt?: string;
  /** ISO 8601 timestamp updated on every persist. */
  updatedAt?: string;
  /**
   * User-authored notes anchored to events on this payload. Mutated only
   * through the IPC notes endpoints — never accepted from external HTTP
   * callers (validation strips this field on `POST /api/file-city/sequence`).
   */
  notes?: SequenceNote[];
}

/**
 * Manifest entry for a saved sequence-diagram payload. Holds metadata only;
 * the full payload is read on demand from disk when activated.
 */
export interface SequenceDiagramIndexEntry {
  id: string;
  repositoryPath?: string;
  title?: string;
  /** First ~200 chars of `payload.summary`, when present. */
  summaryPreview?: string;
  eventCount: number;
  hasDiffSnippets: boolean;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}

/**
 * Note attached to a snippet or markdown span. Lives on the payload
 * (`payload.notes`) so persistence + IPC broadcast piggyback on the existing
 * payload path. Only the renderer can mutate notes — external HTTP POSTs of
 * payloads have any `notes` field stripped during validation.
 */
export interface SequenceSnippetNote {
  id: string;
  kind: 'snippet';
  scope: { eventId: string };
  anchor: SnippetSliceAnchor | SnippetDiffAnchor;
  body: string;
  author?: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 — equal to createdAt until first edit. */
  updatedAt: string;
}

/**
 * Markdown notes anchor to a quoted span using the W3C text-quote selector
 * (matches themed-markdown's `Annotation.anchor` shape).
 */
export interface MarkdownTextQuoteAnchor {
  kind: 'text-quote';
  exact: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Where in the markdown overlay the note is anchored. The overlay swaps
 * between an event's `description` and the payload's `summary`, so we tag
 * which surface the note belongs to.
 */
export type MarkdownNoteScope =
  | { kind: 'description'; eventId: string }
  | { kind: 'summary' };

export interface SequenceMarkdownNote {
  id: string;
  kind: 'markdown';
  scope: MarkdownNoteScope;
  anchor: MarkdownTextQuoteAnchor;
  body: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SliceRange {
  /** 1-based absolute line in the source file (inclusive). */
  startLine: number;
  /** 1-based absolute line (inclusive). For single-line ranges, equals startLine. */
  endLine: number;
  /** startLine's text at creation time — re-anchor fingerprint. */
  startLineText: string;
  /** endLine's text at creation time. Equals startLineText for single-line ranges. */
  endLineText: string;
}

export interface SnippetSliceAnchor {
  kind: 'slice';
  /**
   * One or more disjoint ranges this note covers. Multi-range notes show one
   * indicator pill per range start; the side panel renders one thread.
   */
  ranges: SliceRange[];
}

export interface SnippetDiffAnchor {
  kind: 'diff';
  side: 'deletions' | 'additions';
  lineNumber: number;
}

export type SequenceNote = SequenceSnippetNote | SequenceMarkdownNote;

/** Payload accepted by createNote IPC. Server fills id/createdAt/updatedAt. */
export type SequenceNoteDraft =
  | Omit<SequenceSnippetNote, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<SequenceMarkdownNote, 'id' | 'createdAt' | 'updatedAt'>;

export type { SequenceEvent, SequenceEdge };

/**
 * Renderer-facing API for the File City sequence-diagram bus. The
 * payloads themselves are pushed via HTTP from external callers; this
 * interface gives the renderer subscription + rehydration access.
 */
export interface FileCitySequenceAPI {
  /**
   * Returns the latest payload for the given repo path (or the default
   * slot if no path is supplied), or `null` if none has been set.
   */
  getCurrent: (
    repositoryPath?: string,
  ) => Promise<SequenceDiagramPayload | null>;

  /** Subscribe to "payload set" events. Returns an unsubscribe function. */
  onPayloadSet: (
    callback: (payload: SequenceDiagramPayload) => void,
  ) => () => void;

  /** Subscribe to "payload cleared" events. Returns an unsubscribe function. */
  onPayloadCleared: (
    callback: (info: { repositoryPath?: string }) => void,
  ) => () => void;

  /**
   * List saved payloads. With `repositoryPath`, filters to entries for that
   * repo (plus repo-agnostic entries). Without it, returns every entry.
   * `activeId` is the id currently active for the queried repo (or for the
   * default slot when no repo is supplied).
   */
  list: (repositoryPath?: string) => Promise<{
    entries: SequenceDiagramIndexEntry[];
    activeId: string | null;
  }>;

  /** Read a saved payload by id without activating it. */
  load: (id: string) => Promise<SequenceDiagramPayload | null>;

  /**
   * Mark a saved payload active for its repository and broadcast
   * `PAYLOAD_SET` so any open File City panels update.
   */
  activate: (id: string) => Promise<void>;

  /**
   * Permanently delete a saved payload from disk + manifest. If the deleted
   * entry was active, broadcasts `PAYLOAD_CLEARED` for its repo.
   */
  delete: (id: string) => Promise<void>;

  /** Subscribe to library changes (set / delete / activate). */
  onLibraryChanged: (
    callback: (info: { repositoryPath?: string }) => void,
  ) => () => void;

  /**
   * Create a note on the given payload. Returns the persisted note (with
   * server-assigned id + timestamps). Re-broadcasts PAYLOAD_SET so all
   * windows pick up the new note.
   */
  createNote: (
    payloadId: string,
    draft: SequenceNoteDraft,
  ) => Promise<SequenceNote>;

  /** Update a note's body. Refreshes updatedAt + re-broadcasts PAYLOAD_SET. */
  updateNote: (
    payloadId: string,
    noteId: string,
    body: string,
  ) => Promise<SequenceNote>;

  /** Delete a note. Re-broadcasts PAYLOAD_SET. */
  deleteNote: (payloadId: string, noteId: string) => Promise<void>;
}
