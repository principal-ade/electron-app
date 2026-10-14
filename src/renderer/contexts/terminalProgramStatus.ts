import { useMemo } from 'react';
import type { ProgramStatusRecord } from '@industry-theme/xterm-terminal-panel';

import { useTerminalProgramStatus } from './TerminalContext';

/**
 * Priority for choosing which of a session's OSC 7501 records the tab bar
 * should surface. Lower wins. `blocked` (waiting on you) beats everything.
 */
const PRIORITY: Record<ProgramStatusRecord['state'], number> = {
  blocked: 0,
  error: 1,
  working: 2,
  done: 3,
  idle: 4,
  clear: 5,
};

/**
 * Reduce a session's full record set to the single record the tab bar shows.
 * Root record (no `id`) breaks ties.
 */
export function toPanelProgramStatus(
  recordsBySession: Record<string, ProgramStatusRecord[]>,
): Record<string, ProgramStatusRecord> {
  const result: Record<string, ProgramStatusRecord> = {};
  for (const [sessionId, records] of Object.entries(recordsBySession)) {
    if (!records || records.length === 0) continue;
    const primary = [...records].sort((a, b) => {
      const byState = PRIORITY[a.state] - PRIORITY[b.state];
      if (byState !== 0) return byState;
      return (a.id ? 1 : 0) - (b.id ? 1 : 0);
    })[0];
    result[sessionId] = primary;
  }
  return result;
}

/**
 * OSC 7501 program status, reduced to the shape `TabbedTerminalPanel`'s
 * `programStatus` prop expects (one record per sessionId).
 */
export function usePanelProgramStatus(): Record<string, ProgramStatusRecord> {
  const recordsBySession = useTerminalProgramStatus();
  return useMemo(() => toPanelProgramStatus(recordsBySession), [recordsBySession]);
}
