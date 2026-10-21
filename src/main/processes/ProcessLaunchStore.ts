import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import type { ProcessStartRequest } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

export interface SavedProcessLaunch {
  id: string;
  request: ProcessStartRequest;
}

export interface ProcessLaunchPersistence {
  load: () => SavedProcessLaunch[];
  save: (launches: SavedProcessLaunch[]) => void;
}

/** Launch arguments and environment overrides may contain secrets. Never store
 * them in Home preferences or fall back to plaintext when encryption is unavailable. */
export class ProcessLaunchStore implements ProcessLaunchPersistence {
  private readonly filePath = path.join(
    app.getPath('userData'),
    'pinned-process-launches.enc',
  );

  private requireEncryption(): void {
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' &&
        safeStorage.getSelectedStorageBackend() === 'basic_text')
    ) {
      throw new Error(
        'Secure storage is unavailable. Process pins cannot be saved.',
      );
    }
  }

  load(): SavedProcessLaunch[] {
    if (!fs.existsSync(this.filePath)) return [];
    this.requireEncryption();
    const value: unknown = JSON.parse(
      safeStorage.decryptString(fs.readFileSync(this.filePath)),
    );
    if (
      !Array.isArray(value) ||
      value.some(
        (launch) =>
          !launch ||
          typeof launch.id !== 'string' ||
          typeof launch.request?.command !== 'string' ||
          typeof launch.request?.cwd !== 'string' ||
          !path.isAbsolute(launch.request.cwd) ||
          (launch.request.args !== undefined &&
            (!Array.isArray(launch.request.args) ||
              !launch.request.args.every(
                (arg: unknown) => typeof arg === 'string',
              ))) ||
          (launch.request.env !== undefined &&
            (!launch.request.env ||
              typeof launch.request.env !== 'object' ||
              !Object.values(launch.request.env).every(
                (entry) => typeof entry === 'string',
              ))),
      )
    ) {
      throw new Error('Invalid saved process launch configurations.');
    }
    return value;
  }

  save(launches: SavedProcessLaunch[]): void {
    this.requireEncryption();
    const encrypted = safeStorage.encryptString(JSON.stringify(launches));
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }
}
