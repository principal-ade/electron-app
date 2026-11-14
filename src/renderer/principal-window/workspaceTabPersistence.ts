import type { SavedRequest } from '../../shared/requests/preparedRequest';
import type { WorkspaceTabsSnapshot } from '../../shared/types/userPreferences.types';
import type { WorkspaceTab } from './PortalTabsContext';

const SUPPORTED_TAB_TYPES = new Set([
  'terminal',
  'topics-home',
  'local-topic',
  'markdown-doc',
  'source-file',
  'media',
  'spec',
  'commit-review',
  'project-info',
  'repo-explorer',
  'user-profile',
  'org-profile',
  'file-city-guide',
  'drawing',
  'skill',
  'subsystem-model',
  'c4-sketch',
  'build-configuration',
  'localhost-browser',
  'openbot-chat',
  'http-request',
  'acp',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneRecord(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  try {
    const cloned: unknown = JSON.parse(JSON.stringify(value));
    return isRecord(cloned) ? cloned : null;
  } catch {
    return null;
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function newRequestTabSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `workspace-restore-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function optionalStringFields(
  tab: Record<string, unknown>,
  fields: string[],
): boolean {
  return fields.every((field) => tab[field] === undefined || isString(tab[field]));
}

/**
 * Remove renderer/runtime state before saving. In particular, prepared request
 * definitions live in secure storage, not user preferences; only their stable
 * catalog id is kept here.
 */
function serializeTab(tab: WorkspaceTab): Record<string, unknown> | null {
  if (tab.contentType === 'http-request') {
    return {
      id: tab.id,
      label: tab.label,
      contentType: tab.contentType,
      closable: tab.closable,
      savedRequestId: tab.savedRequestId,
      repositoryPath: tab.repositoryPath,
      target: tab.target,
      customLabel: tab.customLabel,
    };
  }

  const cloned = cloneRecord(tab);
  if (!cloned || !SUPPORTED_TAB_TYPES.has(String(cloned.contentType))) return null;

  if (tab.contentType === 'terminal') {
    // Reconnect by the stable tab id/context; never replay a launch command.
    delete cloned.command;
    delete cloned.startupOverlay;
    // This is transient UI lifecycle state; every snapshot restore starts in
    // reconnect mode again, and the PTY session itself remains authoritative.
    delete cloned.restoreSession;
  } else if (tab.contentType === 'localhost-browser') {
    // These describe the old renderer/process state and are refreshed on restore.
    delete cloned.processStatus;
    delete cloned.processReady;
    delete cloned.processRunCount;
    delete cloned.navigationRevision;
  } else if (tab.contentType === 'source-file') {
    // rangeRevision is an in-renderer navigation signal, not document state.
    delete cloned.rangeRevision;
  } else if (tab.contentType === 'acp') {
    // Auto-start is a one-shot Quick Open hint; restoring it would spawn a
    // fresh agent process every time the app launches.
    delete cloned.autoStart;
  }

  return cloned;
}

export function createWorkspaceTabsSnapshot(
  tabs: WorkspaceTab[],
  activeTabId: string | null,
): WorkspaceTabsSnapshot {
  return {
    version: 1,
    tabs: tabs.flatMap((tab) => {
      const serialized = serializeTab(tab);
      return serialized ? [serialized] : [];
    }),
    activeTabId,
  };
}

function restoreTab(
  raw: unknown,
  catalogRequests: SavedRequest[],
): WorkspaceTab | null {
  const tab = cloneRecord(raw);
  if (
    !tab ||
    !isString(tab.id) ||
    !isString(tab.label) ||
    !isString(tab.contentType) ||
    typeof tab.closable !== 'boolean' ||
    !optionalStringFields(tab, ['customLabel']) ||
    !SUPPORTED_TAB_TYPES.has(tab.contentType)
  ) {
    return null;
  }

  switch (tab.contentType) {
    case 'terminal':
      if (!isString(tab.directory)) return null;
      tab.restoreSession = true;
      break;
    case 'local-topic':
      if (!isString(tab.topicId) || !optionalStringFields(tab, ['title']))
        return null;
      break;
    case 'markdown-doc':
    case 'spec':
      if (
        !isString(tab.filePath) ||
        !optionalStringFields(tab, ['repositoryPath'])
      ) {
        return null;
      }
      break;
    case 'source-file':
    case 'media':
      if (!isString(tab.filePath)) return null;
      break;
    case 'commit-review':
      if (
        !isString(tab.repoPath) ||
        !isString(tab.repoName) ||
        !isRecord(tab.commit)
      ) {
        return null;
      }
      break;
    case 'project-info':
    case 'repo-explorer':
    case 'file-city-guide':
      if (!isString(tab.purl)) return null;
      break;
    case 'user-profile':
      if (!isString(tab.username) || !optionalStringFields(tab, ['email']))
        return null;
      break;
    case 'org-profile':
      if (!isString(tab.orgName)) return null;
      break;
    case 'drawing':
      if (
        !isString(tab.drawingId) ||
        !isString(tab.name) ||
        !optionalStringFields(tab, ['path'])
      ) {
        return null;
      }
      break;
    case 'skill':
      if (!isString(tab.skillId) || !isRecord(tab.skill)) return null;
      break;
    case 'subsystem-model':
      if (!isString(tab.modelId)) return null;
      break;
    case 'c4-sketch':
      if (!isString(tab.sketchId)) return null;
      break;
    case 'build-configuration':
      if (
        !isString(tab.configId) ||
        !optionalStringFields(tab, ['repo'])
      ) {
        return null;
      }
      break;
    case 'localhost-browser':
      if (
        typeof tab.port !== 'number' ||
        !optionalStringFields(tab, ['path', 'processId'])
      ) {
        return null;
      }
      break;
    case 'openbot-chat':
      if (!optionalStringFields(tab, ['agentId', 'botName'])) return null;
      break;
    case 'acp':
      if (
        !isString(tab.directory) ||
        !optionalStringFields(tab, [
          'agent',
          'label',
          'sessionId',
          'sessionTitle',
        ])
      ) {
        return null;
      }
      break;
    case 'http-request': {
      if (!isString(tab.savedRequestId)) return null;
      const definition = catalogRequests.find(
        (request) => request.id === tab.savedRequestId,
      );
      // Request bodies and credentials are deliberately not copied into this
      // snapshot. If the secure catalog no longer has the definition, drop it.
      if (!definition) return null;
      const { request, environment, id } = definition;
      return {
        ...tab,
        sessionId: newRequestTabSessionId(),
        repositoryPath: definition.repositoryPath,
        target:
          isRecord(tab.target) &&
          isString(tab.target.purl) &&
          isString(tab.target.identifier)
            ? { purl: tab.target.purl, identifier: tab.target.identifier }
            : definition.target,
        panelState: {
          request,
          requestId: id,
          environment,
          environmentName: null,
          response: null,
          error: null,
          isSending: false,
        },
      } as unknown as WorkspaceTab;
    }
    case 'topics-home':
      break;
  }

  return tab as unknown as WorkspaceTab;
}

export function restoreWorkspaceTabsSnapshot(
  value: unknown,
  catalogRequests: SavedRequest[],
): { tabs: WorkspaceTab[]; activeTabId: string | null } | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tabs) ||
    value.tabs.length > 200 ||
    !(value.activeTabId === null || isString(value.activeTabId))
  ) {
    return null;
  }

  const tabs = value.tabs.flatMap((raw) => {
    const tab = restoreTab(raw, catalogRequests);
    return tab ? [tab] : [];
  });
  const ids = new Set(tabs.map((tab) => tab.id));
  return {
    tabs,
    activeTabId:
      value.activeTabId && ids.has(value.activeTabId)
        ? value.activeTabId
        : (tabs[0]?.id ?? null),
  };
}
