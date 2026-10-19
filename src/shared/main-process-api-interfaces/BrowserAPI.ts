export interface LocalhostBrowserTarget {
  port: number;
  path: string;
  label?: string;
  /** Managed-process identity, never an OS PID. */
  processId?: string;
}

export interface OpenBrowserEnvelope extends LocalhostBrowserTarget {
  requestId: string;
}

export enum BrowserEvent {
  OPEN = 'browser:open',
  OPENED = 'browser:opened',
  OPEN_LOCALHOST_URL = 'browser:open-localhost-url',
}

export interface BrowserAPI {
  /** Open in the existing principal window, including from a project window. */
  openLocalhostUrl: (url: string) => Promise<{ opened: boolean }>;
  onOpenBrowser: (
    callback: (envelope: OpenBrowserEnvelope) => void,
  ) => () => void;
  acknowledgeOpen: (requestId: string, tabId: string) => void;
}
