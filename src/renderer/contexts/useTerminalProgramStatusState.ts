import { useEffect, useState } from 'react';
import type { ProgramStatusRecord } from '../../shared/terminal/programStatus';
import { onProgramStatus, terminalClient } from '../tipc/terminalClient';

/** Seed newly opened windows, then follow live OSC 7501 broadcasts. */
export function useTerminalProgramStatusState(): Record<
  string,
  ProgramStatusRecord[]
> {
  const [records, setRecords] = useState<Record<string, ProgramStatusRecord[]>>(
    {},
  );

  useEffect(() => {
    let disposed = false;
    const updates: Record<string, ProgramStatusRecord[]> = {};
    // Subscribe first so an update during the initial read cannot be lost.
    const unsubscribe = onProgramStatus(({ sessionId, records: next }) => {
      if (disposed) return;
      updates[sessionId] = next ?? [];
      setRecords((prev) => ({ ...prev, [sessionId]: next ?? [] }));
    });

    terminalClient
      .getAllProgramStatus()
      .then((snapshot) => {
        if (!disposed) setRecords({ ...snapshot, ...updates });
      })
      .catch((error) => {
        if (!disposed)
          console.warn(
            '[TerminalProvider] Failed to load program status:',
            error,
          );
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return records;
}
