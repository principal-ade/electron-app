/**
 * PlanningService - Service layer for planning event subscriptions
 *
 * This service encapsulates all window.mainProcess.planning calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.planning MUST be made through this service.
 */
import type { SlideUpdatedEvent, SlideNavigatedEvent, DocumentLoadedEvent, AgentDocumentRequest, AgentDocumentResponse } from '../../shared/main-process-api-interfaces/PlanningAPI';
/**
 * Service for managing planning event subscriptions
 */
export declare class PlanningService {
    /**
     * Subscribe to slide update events from the planning MCP bridge
     * @param callback - Function to handle slide update events
     * @returns Cleanup function to remove the listener
     */
    static onSlideUpdated(callback: (data: SlideUpdatedEvent) => void): () => void;
    /**
     * Subscribe to slide navigation events from the planning MCP bridge
     * @param callback - Function to handle slide navigation events
     * @returns Cleanup function to remove the listener
     */
    static onSlideNavigated(callback: (data: SlideNavigatedEvent) => void): () => void;
    /**
     * Subscribe to document load events from the planning MCP bridge
     * @param callback - Function to handle document load events
     * @returns Cleanup function to remove the listener
     */
    static onDocumentLoaded(callback: (data: DocumentLoadedEvent) => void): () => void;
    /**
     * Subscribe to agent document request events
     * @param callback - Function to handle agent document requests
     * @returns Cleanup function to remove the listener
     */
    static onAgentDocumentRequest(callback: (data: AgentDocumentRequest) => void): () => void;
    /**
     * Send response to an agent document request
     * @param requestId - The request ID to respond to
     * @param response - The response data
     */
    static sendAgentDocumentResponse(requestId: string, response: AgentDocumentResponse): Promise<void>;
}
//# sourceMappingURL=PlanningService.d.ts.map