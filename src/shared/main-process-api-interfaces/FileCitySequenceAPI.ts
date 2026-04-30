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
}

/**
 * Payload accepted by `POST /api/file-city/sequence` and broadcast to
 * all renderer windows. Re-exports `SequenceEvent`/`SequenceEdge` from
 * `@principal-ai/principal-view-react` so callers reference one shape.
 */
export interface SequenceDiagramPayload {
  /** Optional title shown in the drawer header */
  title?: string;
  /**
   * Optional repo path; renderer hooks filter by this so a payload
   * targets only the matching File City panel when several are open.
   */
  repositoryPath?: string;
  /** Events in display order */
  events: SequenceEvent[];
  /** Edges between events */
  edges: SequenceEdge[];
}

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
}
