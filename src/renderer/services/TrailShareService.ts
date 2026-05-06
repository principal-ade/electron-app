/**
 * Renderer service for web-ade sharing of trail payloads. Wraps
 * `window.mainProcess.fileCityTrail.{share,listShared,fetchShared}` so
 * components/hooks never touch the preload surface directly.
 *
 * Re-throws so user-meaningful error states surface in the UI.
 */

import {
  TrailShareError,
  type FileCityTrailFetchSharedResult,
  type FileCityTrailShareResult,
  type TrailListSharedOptions,
  type TrailListSharedResult,
  type TrailShareOptions,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { TrailPayload } from '@industry-theme/file-city-panel';

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

  /** Render a payload via PAYLOAD_SET broadcast without persisting locally. */
  static async setTransient(payload: TrailPayload): Promise<void> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) throw missingApiError();
    return api.setTransient(payload);
  }
}
