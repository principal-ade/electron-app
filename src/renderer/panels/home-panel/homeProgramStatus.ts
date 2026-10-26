import {
  tabIdFromContext,
  type ProgramStatusRecord,
} from '@industry-theme/xterm-terminal-panel';
import type { TerminalInfo } from '../../../shared/main-process-api-interfaces/TerminalService';

/** Match live status by tab identity, never by cwd (several tabs can share it). */
export function toHomeProgramStatus(
  sessions: Pick<TerminalInfo, 'id' | 'context'>[],
  terminalContext: string,
  programStatus: Record<string, ProgramStatusRecord>,
): Record<string, ProgramStatusRecord> {
  const byTab: Record<string, ProgramStatusRecord> = {};
  for (const session of sessions) {
    const record = programStatus[session.id];
    if (!record) continue;
    const owned = session.context?.startsWith(terminalContext);
    const tabId = owned
      ? (tabIdFromContext(terminalContext, session.context) ??
        `tab-restored-${session.id}`)
      : `tab-foreign-${session.id}`;
    byTab[tabId] = record;
  }
  return byTab;
}
