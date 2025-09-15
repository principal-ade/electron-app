/**
 * PlanningAPI interface for managing planning document events
 * Replaces direct IPC event listeners for planning-related channels
 */
export interface SlideUpdatedEvent {
    filePath: string;
    slideNumber: number;
    content: string;
    slides?: string[];
    currentSlide?: number;
}
export interface SlideNavigatedEvent {
    filePath: string;
    currentSlide: number;
    content: string;
    totalSlides: number;
}
export interface DocumentLoadedEvent {
    filePath: string;
    slides: string[];
    currentSlide: number;
    metadata: {
        title?: string;
        lastModified?: Date;
        totalSlides?: number;
    };
}
export interface AgentDocumentRequest {
    requestId: string;
    agentName: string;
    suggestedTitle?: string;
    suggestedType?: 'markdown' | 'excalidraw';
    message?: string;
}
export interface AgentDocumentResponse {
    success: boolean;
    documentSelected: boolean;
    documentTitle?: string;
    documentType?: 'markdown' | 'excalidraw';
    filePath?: string | null;
    cancelled?: boolean;
}
/**
 * Main PlanningAPI interface
 * These are event listeners for planning events sent from the main process
 */
export interface PlanningAPI {
    /**
     * Listen for slide update events from the planning MCP bridge
     * @param callback - Function to handle slide update events
     * @returns Cleanup function to remove the listener
     */
    onSlideUpdated(callback: (data: SlideUpdatedEvent) => void): () => void;
    /**
     * Listen for slide navigation events from the planning MCP bridge
     * @param callback - Function to handle slide navigation events
     * @returns Cleanup function to remove the listener
     */
    onSlideNavigated(callback: (data: SlideNavigatedEvent) => void): () => void;
    /**
     * Listen for document load events from the planning MCP bridge
     * @param callback - Function to handle document load events
     * @returns Cleanup function to remove the listener
     */
    onDocumentLoaded(callback: (data: DocumentLoadedEvent) => void): () => void;
    /**
     * Listen for agent document requests
     * @param callback - Function to handle agent document requests
     * @returns Cleanup function to remove the listener
     */
    onAgentDocumentRequest(callback: (data: AgentDocumentRequest) => void): () => void;
    /**
     * Send response to agent document request
     * @param requestId - The request ID to respond to
     * @param response - The response data
     */
    sendAgentDocumentResponse(requestId: string, response: AgentDocumentResponse): Promise<void>;
}
//# sourceMappingURL=PlanningAPI.d.ts.map