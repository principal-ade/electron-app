import * as path from 'path';
import type { TerminalSessionManager } from './TerminalSessionManager';

type SessionManager = Pick<
  TerminalSessionManager,
  'getAllSessions' | 'destroySessionAndWaitForExit'
>;

/** Close only terminals belonging to this checkout, not other clones. */
export async function closeRepositoryTerminals(
  manager: SessionManager,
  repositoryPath: string,
): Promise<void> {
  const isWithinClone = (directory: string): boolean => {
    const relative = path.relative(repositoryPath, directory);
    return (
      relative === '' ||
      (relative !== '..' &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    );
  };
  const sessions = Array.from(manager.getAllSessions().values()).filter(
    (session) =>
      isWithinClone(session.directory) ||
      (session.repoPath !== undefined && isWithinClone(session.repoPath)),
  );
  await Promise.all(
    sessions.map((session) => manager.destroySessionAndWaitForExit(session.id)),
  );
}
