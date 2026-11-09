import type { AgentSessionBookmark } from './types/userPreferences.types';

type AgentSessionIdentity = Pick<
  AgentSessionBookmark,
  'agent' | 'directory' | 'id'
>;

/** Stable key persisted in preferences for a session-history bookmark. */
export function agentSessionBookmarkKey(session: AgentSessionIdentity): string {
  return JSON.stringify([session.agent, session.directory, session.id]);
}

/** Stable workspace tab id used to associate a resumed bookmarked session. */
export function agentSessionBookmarkTabId(
  session: AgentSessionIdentity,
): string {
  return `agent-session-bookmark:${encodeURIComponent(agentSessionBookmarkKey(session))}`;
}
