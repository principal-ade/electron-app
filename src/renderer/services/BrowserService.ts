import type { OpenBrowserEnvelope } from '../../shared/main-process-api-interfaces/BrowserAPI';

export class BrowserService {
  static onOpenBrowser(callback: (envelope: OpenBrowserEnvelope) => void) {
    return window.mainProcess?.browser?.onOpenBrowser(callback) ?? (() => {});
  }

  static acknowledgeOpen(requestId: string, tabId: string): void {
    window.mainProcess?.browser?.acknowledgeOpen(requestId, tabId);
  }
}
