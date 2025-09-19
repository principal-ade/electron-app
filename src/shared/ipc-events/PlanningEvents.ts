/**
 * Planning IPC channel enums
 * Shared between main and renderer processes
 */

export enum PlanningEvent {
  SLIDE_UPDATED = 'planning:slide-updated',
  SLIDE_NAVIGATED = 'planning:slide-navigated',
  DOCUMENT_LOADED = 'planning:document-loaded',
  AGENT_DOCUMENT_REQUEST = 'planning:agent-document-request',
  AGENT_DOCUMENT_RESPONSE = 'planning:agent-document-response',
}
