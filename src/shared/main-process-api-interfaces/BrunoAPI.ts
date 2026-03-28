import type { BrunoRequest, BrunoResponse } from '@principal-ade/bruno-panels';

/**
 * Bruno API Events for IPC communication
 */
export enum BrunoAPIEvent {
  SEND_REQUEST = 'bruno:sendRequest',
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
}
