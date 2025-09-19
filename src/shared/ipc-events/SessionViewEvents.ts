/**
 * Session View IPC channel enums
 * Shared between main and renderer processes
 */

export enum SessionViewEvent {
  GET_VIEW = 'session-view:get-view',
  GET_SEGMENT = 'session-view:get-segment',
  GET_STATISTICS = 'session-view:get-statistics',
}
