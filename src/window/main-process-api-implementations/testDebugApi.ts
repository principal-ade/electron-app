import { ipcRenderer } from 'electron';

/**
 * Test and Debug API implementation for renderer process
 * 
 * IMPORTANT: These are debug/test utilities and should NOT be used in production code.
 * They are only exposed to support development and debugging features.
 */
export const testDebugAPI = {
  /**
   * Process a raw agent event through the normalization pipeline
   * Used by EventProcessingTestView for testing event processing
   * 
   * @param agent - The agent type (cursor, windsurf, aider, continue)
   * @param rawEvent - The raw event data to process
   */
  processEvent: async (agent: string, rawEvent: unknown) => {
    return ipcRenderer.invoke('test:process-event', agent, rawEvent);
  },
};