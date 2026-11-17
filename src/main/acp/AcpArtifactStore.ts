/**
 * Persistence for user-attached ACP artifacts.
 *
 * Associations are scoped to the agent session id rather than the renderer tab:
 * reopening the same ACP session from Home, or restoring it after a restart,
 * should bring its associated docs back. The file holds only public ids and
 * titles, so plain JSON is sufficient.
 */
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { AcpArtifactAssociation } from '../../shared/main-process-api-interfaces/AcpAPI';

const MAX_SESSIONS = 500;
const MAX_ARTIFACT_ID_LENGTH = 200;
const MAX_ARTIFACT_TITLE_LENGTH = 300;

interface PersistedSessionArtifacts {
  artifacts: AcpArtifactAssociation[];
  updatedAt: number;
}

interface PersistedState {
  version: 1;
  sessions: Record<string, PersistedSessionArtifacts>;
}

function isArtifact(value: unknown): value is AcpArtifactAssociation {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as Record<string, unknown>;
  if (
    artifact.kind !== 'topic' &&
    artifact.kind !== 'subsystem-model' &&
    artifact.kind !== 'drawing'
  ) {
    return false;
  }
  if (
    typeof artifact.id !== 'string' ||
    artifact.id.length === 0 ||
    artifact.id.length > MAX_ARTIFACT_ID_LENGTH
  ) {
    return false;
  }
  if (artifact.title === undefined) return true;
  return typeof artifact.title === 'string';
}

function artifactKey(artifact: AcpArtifactAssociation): string {
  return `${artifact.kind}:${artifact.id}`;
}

export function dedupeArtifacts(
  artifacts: AcpArtifactAssociation[],
): AcpArtifactAssociation[] {
  const byKey = new Map<string, AcpArtifactAssociation>();
  for (const artifact of artifacts) {
    if (!isArtifact(artifact)) continue;
    const title = artifact.title?.trim().slice(0, MAX_ARTIFACT_TITLE_LENGTH);
    byKey.set(artifactKey(artifact), {
      kind: artifact.kind,
      id: artifact.id,
      ...(title ? { title } : {}),
    });
  }
  return [...byKey.values()];
}

export class AcpArtifactStore {
  constructor(
    private readonly filePath = path.join(
      app.getPath('userData'),
      'acp-session-artifacts.json',
    ),
  ) {}

  load(agentId: string, sessionId: string): AcpArtifactAssociation[] {
    const key = this.sessionKey(agentId, sessionId);
    return this.read().sessions[key]?.artifacts ?? [];
  }

  save(
    agentId: string,
    sessionId: string,
    artifacts: AcpArtifactAssociation[],
  ): AcpArtifactAssociation[] {
    const key = this.sessionKey(agentId, sessionId);
    const state = this.read();
    const deduped = dedupeArtifacts(artifacts);
    if (deduped.length === 0) {
      delete state.sessions[key];
    } else {
      state.sessions[key] = { artifacts: deduped, updatedAt: Date.now() };
    }
    this.write(this.prune(state));
    return deduped;
  }

  private sessionKey(agentId: string, sessionId: string): string {
    return `${agentId}:${sessionId}`;
  }

  private prune(state: PersistedState): PersistedState {
    const entries = Object.entries(state.sessions);
    if (entries.length <= MAX_SESSIONS) return state;
    entries.sort(
      ([, left], [, right]) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
    );
    return {
      version: 1,
      sessions: Object.fromEntries(entries.slice(0, MAX_SESSIONS)),
    };
  }

  private read(): PersistedState {
    if (!fs.existsSync(this.filePath)) {
      return { version: 1, sessions: {} };
    }
    try {
      const value: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (
        !value ||
        typeof value !== 'object' ||
        (value as { version?: unknown }).version !== 1 ||
        !(value as { sessions?: unknown }).sessions ||
        typeof (value as { sessions: unknown }).sessions !== 'object'
      ) {
        return { version: 1, sessions: {} };
      }
      const sessions: Record<string, PersistedSessionArtifacts> = {};
      for (const [key, entry] of Object.entries(
        (value as { sessions: Record<string, unknown> }).sessions,
      )) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as {
          artifacts?: unknown;
          updatedAt?: unknown;
        };
        if (!Array.isArray(candidate.artifacts)) continue;
        sessions[key] = {
          artifacts: dedupeArtifacts(candidate.artifacts.filter(isArtifact)),
          updatedAt:
            typeof candidate.updatedAt === 'number' ? candidate.updatedAt : 0,
        };
      }
      return { version: 1, sessions };
    } catch (error) {
      console.warn('[ACP] Could not read artifact associations:', error);
      return { version: 1, sessions: {} };
    }
  }

  private write(state: PersistedState): void {
    const temporary = `${this.filePath}.tmp`;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), {
      mode: 0o600,
    });
    fs.renameSync(temporary, this.filePath);
  }
}
