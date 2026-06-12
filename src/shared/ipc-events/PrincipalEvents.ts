/**
 * Principal MCP IPC channel enums
 * Shared between main and renderer processes
 */

export enum PrincipalEvent {
  SLIDE_UPDATED = 'principal:slide-updated',
  SLIDE_NAVIGATED = 'principal:slide-navigated',
  DOCUMENT_LOADED = 'principal:document-loaded',
}
