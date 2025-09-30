/**
 * PrincipalService - Service layer for principal MCP event subscriptions
 *
 * This service encapsulates all window.mainProcess.principal calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.principal MUST be made through this service.
 */

import type {
  SlideUpdatedEvent,
  SlideNavigatedEvent,
  DocumentLoadedEvent,
  AgentDocumentRequest,
  AgentDocumentResponse,
} from '../../shared/main-process-api-interfaces/PrincipalAPI';

/**
 * Service for managing principal MCP event subscriptions
 */
export class PrincipalService {
  /**
   * Subscribe to slide update events from the principal MCP bridge
   * @param callback - Function to handle slide update events
   * @returns Cleanup function to remove the listener
   */
  static onSlideUpdated(
    callback: (data: SlideUpdatedEvent) => void,
  ): () => void {
    try {
      return window.mainProcess.principal.onSlideUpdated(callback);
    } catch (error) {
      console.error(
        '[PrincipalService] Failed to subscribe to slide updates:',
        error,
      );
      // Return a no-op cleanup function
      return () => {};
    }
  }

  /**
   * Subscribe to slide navigation events from the principal MCP bridge
   * @param callback - Function to handle slide navigation events
   * @returns Cleanup function to remove the listener
   */
  static onSlideNavigated(
    callback: (data: SlideNavigatedEvent) => void,
  ): () => void {
    try {
      return window.mainProcess.principal.onSlideNavigated(callback);
    } catch (error) {
      console.error(
        '[PrincipalService] Failed to subscribe to slide navigation:',
        error,
      );
      // Return a no-op cleanup function
      return () => {};
    }
  }

  /**
   * Subscribe to document load events from the principal MCP bridge
   * @param callback - Function to handle document load events
   * @returns Cleanup function to remove the listener
   */
  static onDocumentLoaded(
    callback: (data: DocumentLoadedEvent) => void,
  ): () => void {
    try {
      return window.mainProcess.principal.onDocumentLoaded(callback);
    } catch (error) {
      console.error(
        '[PrincipalService] Failed to subscribe to document loads:',
        error,
      );
      // Return a no-op cleanup function
      return () => {};
    }
  }

  /**
   * Subscribe to agent document request events
   * @param callback - Function to handle agent document requests
   * @returns Cleanup function to remove the listener
   */
  static onAgentDocumentRequest(
    callback: (data: AgentDocumentRequest) => void,
  ): () => void {
    try {
      return window.mainProcess.principal.onAgentDocumentRequest(callback);
    } catch (error) {
      console.error(
        '[PrincipalService] Failed to subscribe to agent document requests:',
        error,
      );
      // Return a no-op cleanup function
      return () => {};
    }
  }

  /**
   * Send response to an agent document request
   * @param requestId - The request ID to respond to
   * @param response - The response data
   */
  static async sendAgentDocumentResponse(
    requestId: string,
    response: AgentDocumentResponse,
  ): Promise<void> {
    try {
      await window.mainProcess.principal.sendAgentDocumentResponse(
        requestId,
        response,
      );
    } catch (error) {
      console.error(
        '[PrincipalService] Failed to send agent document response:',
        error,
      );
      throw new Error('Failed to send agent document response');
    }
  }
}
