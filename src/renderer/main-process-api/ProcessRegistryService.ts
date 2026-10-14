import type {
  ProcessEntry,
  ProcessStartRequest,
  ProcessStartResult,
  ProcessControlResult,
} from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

/**
 * Renderer wrapper over the main-process process registry
 * (`window.mainProcess.processes`).
 */
export const ProcessRegistryService = {
  list: (): Promise<ProcessEntry[]> => window.mainProcess.processes.list(),

  start: (request: ProcessStartRequest): Promise<ProcessStartResult> =>
    window.mainProcess.processes.start(request),

  stop: (id: string): Promise<ProcessControlResult> =>
    window.mainProcess.processes.stop(id),

  restart: (id: string): Promise<ProcessStartResult> =>
    window.mainProcess.processes.restart(id),

  remove: (id: string): Promise<ProcessControlResult> =>
    window.mainProcess.processes.remove(id),

  onChanged: (
    callback: (processes: ProcessEntry[]) => void,
  ): (() => void) => window.mainProcess.processes.onChanged(callback),
};

export type {
  ProcessEntry,
  ProcessStartRequest,
  ProcessStartResult,
  ProcessControlResult,
};
