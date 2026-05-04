/**
 * Renderer service for web-ade sharing of sequence-diagram payloads. Wraps
 * `window.mainProcess.fileCitySequence.{share,listShared,fetchShared}` so
 * components/hooks never touch the preload surface directly.
 *
 * Unlike the read-only sibling services (`SequenceDiagramService`,
 * `SequenceDiagramLibraryService`), this one re-throws — share/list/fetch
 * have user-meaningful error states (no token, no remote, missing files,
 * no access) that need to be surfaced in the UI.
 */

import {
  SequenceDiagramShareError,
  type FileCitySequenceFetchSharedResult,
  type FileCitySequenceShareResult,
  type SequenceDiagramListSharedOptions,
  type SequenceDiagramListSharedResult,
  type SequenceDiagramPayload,
  type SequenceDiagramShareOptions,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const missingApiError = (): SequenceDiagramShareError =>
  new SequenceDiagramShareError(
    'WEB_ADE_ERROR',
    'Desktop bridge is unavailable in this window.',
  );

export class SequenceDiagramShareService {
  static async share(
    id: string,
    options?: SequenceDiagramShareOptions,
  ): Promise<FileCitySequenceShareResult> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) throw missingApiError();
    return api.share(id, options);
  }

  static async listShared(
    options?: SequenceDiagramListSharedOptions,
  ): Promise<SequenceDiagramListSharedResult> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) throw missingApiError();
    return api.listShared(options);
  }

  static async fetchShared(
    owner: string,
    repo: string,
    id: string,
  ): Promise<FileCitySequenceFetchSharedResult> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) throw missingApiError();
    return api.fetchShared(owner, repo, id);
  }

  /** Render a payload via PAYLOAD_SET broadcast without persisting locally. */
  static async setTransient(payload: SequenceDiagramPayload): Promise<void> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) throw missingApiError();
    return api.setTransient(payload);
  }
}
