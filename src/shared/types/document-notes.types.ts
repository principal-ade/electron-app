/**
 * Types for user-authored notes attached to markdown documents.
 *
 * The annotation primitives (`TextQuoteAnchor`, `Annotation`) mirror the
 * shape exported by `themed-markdown`'s annotation system, which uses W3C
 * text-quote selectors to anchor highlights to ranges of literal text plus
 * optional surrounding context.
 *
 * TODO: move `TextQuoteAnchor` and `Annotation` to `principal-view-core` once
 * that package exists, and re-export from there. Defining them here keeps
 * the main process from depending on `themed-markdown` (a renderer-only
 * package) while we wait for the shared lib.
 *
 * https://www.w3.org/TR/annotation-model/#text-quote-selector
 */

export interface TextQuoteAnchor {
  /** The literal text being annotated. */
  exact: string;
  /** Text immediately preceding `exact`, used for disambiguation. */
  prefix?: string;
  /** Text immediately following `exact`, used for disambiguation. */
  suffix?: string;
}

export interface Annotation<TMetadata = unknown> {
  id: string;
  anchor: TextQuoteAnchor;
  metadata?: TMetadata;
  /**
   * Optional badge count rendered in the top-right of the highlight (e.g.
   * number of notes attached to this anchor).
   */
  count?: number;
}

/**
 * Metadata payload attached to a document note.
 */
export interface DocumentNoteMetadata {
  body: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A persisted document note. Structurally compatible with what DocumentView
 * consumes via its `annotations` prop (Annotation<DocumentNoteMetadata>),
 * but with `metadata` required — every persisted note has a body.
 */
export interface DocumentNote extends Annotation<DocumentNoteMetadata> {
  metadata: DocumentNoteMetadata;
}

/**
 * Draft passed to `createNote` — id + timestamps are assigned by the store.
 */
export interface DocumentNoteDraft {
  anchor: TextQuoteAnchor;
  body: string;
  author?: string;
}

/**
 * Summary entry returned by the library endpoint — one per file that has
 * notes stored. Used by both the HTTP bridge route and the IPC API.
 */
export interface DocumentNotesFileSummary {
  repositoryPath?: string;
  relativeFilePath: string;
  fileHash: string;
  noteCount: number;
  updatedAt: string;
  sizeBytes: number;
}
