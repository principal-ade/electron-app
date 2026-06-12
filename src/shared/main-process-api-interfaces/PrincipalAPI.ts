/**
 * PrincipalAPI interface for managing principal MCP document events
 * Replaces direct IPC event listeners for principal-related channels
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

/**
 * Main PrincipalAPI interface
 * These are event listeners for principal MCP events sent from the main process
 */
export interface PrincipalAPI {
  /**
   * Listen for slide update events from the principal MCP bridge
   * @param callback - Function to handle slide update events
   * @returns Cleanup function to remove the listener
   */
  onSlideUpdated(callback: (data: SlideUpdatedEvent) => void): () => void;

  /**
   * Listen for slide navigation events from the principal MCP bridge
   * @param callback - Function to handle slide navigation events
   * @returns Cleanup function to remove the listener
   */
  onSlideNavigated(callback: (data: SlideNavigatedEvent) => void): () => void;

  /**
   * Listen for document load events from the principal MCP bridge
   * @param callback - Function to handle document load events
   * @returns Cleanup function to remove the listener
   */
  onDocumentLoaded(callback: (data: DocumentLoadedEvent) => void): () => void;
}
