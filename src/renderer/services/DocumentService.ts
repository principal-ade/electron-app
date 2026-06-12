/**
 * Renderer service for opening documents pushed from the Principal MCP Bridge.
 * Wraps `window.mainProcess.document` so components/hooks never touch the
 * preload surface directly.
 *
 * Sibling: `TrailService` (active trail payload + warm-start handoff).
 */

import type { OpenDocumentEnvelope } from '../../shared/main-process-api-interfaces/DocumentAPI';

const noop = () => {};

export class DocumentService {
  /**
   * Subscribe to OPEN_DOCUMENT. Fired when the bridge routes a document to
   * this window because it is the focused, doc-tab-capable surface
   * (dev-workspace or Alexandria-workspace). Subscribers should open/focus a
   * tab for the file — typically by re-emitting it as a `file:opened` panel
   * event. Returns an unsubscribe function.
   */
  static onOpenDocument(
    callback: (envelope: OpenDocumentEnvelope) => void,
  ): () => void {
    return window.mainProcess?.document?.onOpenDocument(callback) ?? noop;
  }
}
