/**
 * Renderer service for web-ade sharing of trail payloads. Wraps
 * `window.mainProcess.fileCityTrail.{share,listShared,fetchShared}` so
 * components/hooks never touch the preload surface directly.
 *
 * Re-throws so user-meaningful error states surface in the UI.
 */

import {
  TrailShareError,
  type FileCityTrailFetchSharedByIdResult,
  type FileCityTrailFetchSharedResult,
  type FileCityTrailShareResult,
  type TrailListSharedOptions,
  type TrailListSharedResult,
  type TrailShareOptions,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type {
  TrailPayload,
  TrailNote,
  TrailNoteDraft,
} from '@industry-theme/file-city-panel';

const missingApiError = (): TrailShareError =>
  new TrailShareError(
    'WEB_ADE_ERROR',
    'Desktop bridge is unavailable in this window.',
  );

export class TrailShareService {
  static async share(
    id: string,
    options?: TrailShareOptions,
  ): Promise<FileCityTrailShareResult> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) throw missingApiError();
    return api.share(id, options);
  }

  static async listShared(
    options?: TrailListSharedOptions,
  ): Promise<TrailListSharedResult> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) throw missingApiError();
    return api.listShared(options);
  }

  static async fetchShared(
    owner: string,
    repo: string,
    id: string,
  ): Promise<FileCityTrailFetchSharedResult> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) throw missingApiError();
    return api.fetchShared(owner, repo, id);
  }

  /**
   * Hydrate a shared trail from a bare id (no owner/repo). web-ade resolves
   * the owning repo and gates access. Used by the titlebar to open a pasted
   * `…/trail/{id}` URL.
   */
  static async fetchSharedById(
    id: string,
  ): Promise<FileCityTrailFetchSharedByIdResult> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) throw missingApiError();
    return api.fetchSharedById(id);
  }

  /**
   * Create a note on a published trail via web-ade. The remote counterpart to
   * `TrailNotesService.create` (local disk), used for inbox/shared trails
   * whose payloads aren't in the local store. Re-throws so the caller can
   * surface a user-meaningful error.
   */
  static async createSharedNote(
    id: string,
    draft: TrailNoteDraft,
  ): Promise<TrailNote> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) throw missingApiError();
    return api.createSharedNote(id, draft);
  }

  /**
   * Push a payload to the panel for `repositoryPath`'s windows via
   * `PAYLOAD_SET` without persisting locally. The caller is the renderer
   * that just hydrated the share, so it knows the repo it should be
   * scoped to. Used to preview a fetched-but-unsaved shared trail.
   */
  static async setTransient(
    payload: TrailPayload,
    repositoryPath: string | undefined,
  ): Promise<void> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) throw missingApiError();
    return api.setTransient(payload, repositoryPath);
  }
}
