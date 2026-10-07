/**
 * Document API — open a document into a window that already hosts a tabbed
 * terminal (the dev-workspace surface).
 *
 * The Principal MCP Bridge exposes `POST /api/document/open`. When the
 * currently-focused window is a doc-tab-capable surface, the route pushes an
 * `OPEN_DOCUMENT` IPC to that one window; the renderer re-emits it onto the
 * panel event bus as a `file:opened` event, reusing the existing markdown /
 * source / media tab-opening handlers. There is no cold-start path — the
 * route only ever targets an already-open, already-focused window.
 */

/** IPC event names for document operations. */
export enum DocumentEvent {
  OPEN_DOCUMENT = 'document:open',
}

/** Envelope for `OPEN_DOCUMENT` IPC — tells the focused window to open (or
 *  focus) a tab for the given file. `repositoryPath` is the host repo the
 *  file belongs to (used for context resolution by the renderer); the file
 *  path itself is absolute. */
export interface OpenDocumentEnvelope {
  filePath: string;
  repositoryPath?: string;
}

export interface DocumentAPI {
  /**
   * Subscribe to `OPEN_DOCUMENT`. Fired when the bridge routes a document to
   * this (focused, doc-tab-capable) window. Returns an unsubscribe fn.
   */
  onOpenDocument: (
    callback: (envelope: OpenDocumentEnvelope) => void,
  ) => () => void;
}
