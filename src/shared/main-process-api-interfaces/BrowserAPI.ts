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
}

export interface BrowserAPI {
  onOpenBrowser: (
    callback: (envelope: OpenBrowserEnvelope) => void,
  ) => () => void;
  acknowledgeOpen: (requestId: string, tabId: string) => void;
}
