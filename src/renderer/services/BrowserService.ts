import type { OpenBrowserEnvelope } from '../../shared/main-process-api-interfaces/BrowserAPI';

export class BrowserService {
  static async openLocalhostUrl(url: string): Promise<boolean> {
    const result = await window.mainProcess?.browser?.openLocalhostUrl?.(url);
    return result?.opened === true;
  }

  static onOpenBrowser(callback: (envelope: OpenBrowserEnvelope) => void) {
    return window.mainProcess?.browser?.onOpenBrowser(callback) ?? (() => {});
  }

  static acknowledgeOpen(requestId: string, tabId: string): void {
    window.mainProcess?.browser?.acknowledgeOpen(requestId, tabId);
  }
}
