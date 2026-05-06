/**
 * Web-ade integration for File City trail payloads.
 *
 * Parallel surface to `sequenceDiagramShare.ts`. Trail-flavored web-ade
 * endpoints are not yet implemented; until they ship, the share /
 * listShared / fetchShared paths throw `WEB_ADE_ERROR` so the IPC surface
 * matches the sequence one without needing a server-side counterpart.
 *
 * When the trail share endpoints land on web-ade, port the bake step,
 * origin resolution, and HTTP plumbing from `sequenceDiagramShare.ts` —
 * the type shapes and error codes are already aligned.
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

const NOT_IMPLEMENTED_MESSAGE =
  'Trail share endpoints are not yet available on web-ade.';

interface ShareDeps {
  loadPayload: (id: string) => Promise<TrailPayload | null>;
}

export async function shareTrail(
  _deps: ShareDeps,
  _id: string,
  _options?: TrailShareOptions,
): Promise<FileCityTrailShareResult> {
  throw new TrailShareError('WEB_ADE_ERROR', NOT_IMPLEMENTED_MESSAGE);
}

export async function listSharedTrails(
  _options?: TrailListSharedOptions,
): Promise<TrailListSharedResult> {
  // Renderer treats listShared as a non-error empty for the common
  // "no remote / no token / no shares" cases. Mirror that here so the
  // sidebar renders cleanly until web-ade endpoints land.
  return { origin: { owner: '', repo: '' }, entries: [] };
}

export async function fetchSharedTrail(
  _owner: string,
  _repo: string,
  _id: string,
): Promise<FileCityTrailFetchSharedResult> {
  throw new TrailShareError('SHARE_NOT_FOUND', NOT_IMPLEMENTED_MESSAGE);
}
