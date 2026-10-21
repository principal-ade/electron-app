import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  parseCatalogRequest,
  parseSavedRequest,
  requestDefinition,
  type CatalogRequest,
  type SavedRequest,
} from '../../shared/requests/preparedRequest';
import { requestRouteKey } from '../../shared/requests/requestRoute';

export const MAX_CATALOG_REQUESTS = 1000;

/** Definitions and environment overrides may contain credentials. No plaintext
 * fallback; responses are never persisted. */
export class RequestStore {
  private readonly filePath = path.join(
    app.getPath('userData'),
    'pinned-http-requests.enc',
  );

  private requireEncryption(): void {
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' &&
        safeStorage.getSelectedStorageBackend() === 'basic_text')
    ) {
      throw new Error(
        'Secure storage is unavailable. Requests cannot be remembered.',
      );
    }
  }

  load(): SavedRequest[] {
    return this.loadRoutes()
      .filter((request) => request.pinned)
      .map(requestDefinition);
  }

  loadRoutes(): CatalogRequest[] {
    if (!fs.existsSync(this.filePath)) return [];
    this.requireEncryption();
    const value: unknown = JSON.parse(
      safeStorage.decryptString(fs.readFileSync(this.filePath)),
    );
    // Legacy arrays held pins only. Preserve every definition and id on migration.
    if (Array.isArray(value)) {
      return value.map((entry) => ({
        ...parseSavedRequest(entry),
        pinned: true,
      }));
    }
    if (
      !value ||
      typeof value !== 'object' ||
      (value as { version?: unknown }).version !== 1 ||
      !Array.isArray((value as { requests?: unknown }).requests)
    ) {
      throw new Error('Invalid request catalog.');
    }
    return (value as { requests: unknown[] }).requests.map(parseCatalogRequest);
  }

  private save(requests: CatalogRequest[]): void {
    this.requireEncryption();
    const encrypted = safeStorage.encryptString(
      JSON.stringify({ version: 1, requests }),
    );
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }

  pin(value: unknown): SavedRequest[] {
    return this.writeDefinition(value, true)
      .filter((entry) => entry.pinned)
      .map(requestDefinition);
  }

  /** Preparing a route reuses its id and favorite state, and replaces only its definition. */
  remember(value: unknown): SavedRequest {
    const request = parseSavedRequest(value);
    const routes = this.loadRoutes();
    const key = requestRouteKey(request);
    const existing = routes.find((entry) => requestRouteKey(entry) === key);
    if (!existing && routes.length >= MAX_CATALOG_REQUESTS) {
      throw new Error(
        'Route catalog is full. Forget a route before adding another.',
      );
    }
    const id =
      existing?.id ??
      (routes.some((entry) => entry.id === request.id)
        ? randomUUID()
        : request.id);
    const remembered = { ...request, id };
    const next = routes.filter((entry) => entry.id !== id);
    next.push({ ...remembered, pinned: existing?.pinned ?? false });
    this.save(next);
    return remembered;
  }

  /** Explicit edits retain the selected record's id and do not turn it into a favorite. */
  update(value: unknown): CatalogRequest[] {
    return this.writeDefinition(value);
  }

  private writeDefinition(value: unknown, pinned?: boolean): CatalogRequest[] {
    const request = parseSavedRequest(value);
    const routes = this.loadRoutes();
    const existing = routes.find((entry) => entry.id === request.id);
    if (
      routes.some(
        (entry) =>
          entry.id !== request.id &&
          requestRouteKey(entry) === requestRouteKey(request),
      )
    ) {
      throw new Error(
        'This route is already remembered. Open its existing entry instead.',
      );
    }
    if (!existing && routes.length >= MAX_CATALOG_REQUESTS) {
      throw new Error(
        'Route catalog is full. Forget a route before adding another.',
      );
    }
    const next = routes.filter((entry) => entry.id !== request.id);
    next.push({ ...request, pinned: pinned ?? existing?.pinned ?? false });
    this.save(next);
    return next;
  }

  unpin(id: string): SavedRequest[] {
    const next = this.loadRoutes().map((entry) =>
      entry.id === id ? { ...entry, pinned: false } : entry,
    );
    this.save(next);
    return next.filter((entry) => entry.pinned).map(requestDefinition);
  }

  forget(id: string): CatalogRequest[] {
    const routes = this.loadRoutes();
    if (routes.some((entry) => entry.id === id && entry.pinned)) {
      throw new Error('Unpin the route before forgetting it.');
    }
    const next = routes.filter((entry) => entry.id !== id);
    this.save(next);
    return next;
  }
}
