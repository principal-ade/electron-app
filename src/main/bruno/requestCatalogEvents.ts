import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';

/** Invalidate other MAIN windows without broadcasting definitions or credentials. */
export function notifyRequestCatalogChanged(): void {
  for (const { window, metadata } of applicationWindows.values()) {
    if (metadata.primaryType !== PrimaryWindowType.MAIN || window.isDestroyed())
      continue;
    try {
      window.webContents.send(BrunoAPIEvent.CATALOG_CHANGED);
    } catch {
      // A closing window will reload the catalog the next time it mounts.
    }
  }
}
