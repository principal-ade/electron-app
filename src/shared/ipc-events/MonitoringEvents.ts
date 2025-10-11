/**
 * Monitoring IPC channel enums
 * Shared between main and renderer processes
 */

export enum MonitoringEvent {
  GET_MONITORING_STATUS = 'monitoring:get-status',
  START_MONITORING = 'monitoring:start',
  STOP_MONITORING = 'monitoring:stop',
  GET_EVENT_METRICS = 'monitoring:get-event-metrics',
}
