import type { BrunoRequest, BrunoResponse, BrunoEnvironment } from '@principal-ade/bruno-panels';

/**
 * Bruno API Events for IPC communication
 */
export enum BrunoAPIEvent {
  SEND_REQUEST = 'bruno:sendRequest',
  LOAD_BRU_REQUEST = 'bruno:loadBruRequest',
  LOAD_ENVIRONMENTS = 'bruno:loadEnvironments',
}

/**
 * Bruno Panel API Interface
 */
export interface BrunoAPI {
  /**
   * Send an HTTP request using Bruno request format
   */
  sendRequest: (
    request: BrunoRequest,
    environment?: Record<string, string>,
  ) => Promise<BrunoResponse>;

  /**
   * Load and parse a .bru file, returning a BrunoRequest.
   * Parsing happens on the host side using @usebruno/lang.
   */
  loadBruRequest: (path: string) => Promise<BrunoRequest>;

  /**
   * Load all environments from environments/*.json files in the collection
   */
  loadEnvironments: (collectionPath: string) => Promise<BrunoEnvironment[]>;
}
