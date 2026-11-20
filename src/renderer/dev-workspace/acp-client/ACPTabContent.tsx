import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileCityLogoAnimated } from '@principal-ai/logo-component';
import { XCircle } from 'lucide-react';
import type {
  ContentBlock,
  SessionUpdate,
  ToolCallContent,
  ToolCallLocation,
  ToolCallUpdate,
} from '@agentclientprotocol/sdk';
import {
  DEFAULT_ACP_AGENT,
  getAcpAgent,
  normalizeAcpModelSelection,
  type AcpModelSelection,
  type AcpToolProcessingResult,
  type AcpAgentId,
  type AcpArtifactAssociation,
} from '../../../shared/main-process-api-interfaces/AcpAPI';
import type { AcpLinkedPullRequest, AcpTab } from '../../events/portalTabs';
import { AcpService } from '../../main-process-api/AcpService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import {
  acpArtifactKey,
  dedupeAcpArtifacts,
} from '../../utils/acpArtifactDrag';
import type { ACPClientViewState } from './ACPClientView';
import { ACPWorkspaceIdentity } from './ACPWorkspaceIdentity';
import { useAcpArtifactDrop } from './useAcpArtifactDrop';
import { getAcpThemeStyle } from './acpTheme';
import {
  ACPSessionView,
  isAcpModelReference,
  isAcpTopicReference,
  type AcpChatMessage,
  type AcpChatReference,
  type AcpPendingPermission,
} from './ACPSessionView';
import './ACPClientView.css';

export interface ACPTabContentProps {
  tab: AcpTab;
  /** Whether this tab is the currently shown one in its panel. */
  isActive?: boolean;
  onSessionIdChange?: (sessionId: string) => void;
  onSessionTitleChange?: (title: string | null) => void;
  onPullRequestChange?: (pullRequest: AcpLinkedPullRequest | null) => void;
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'The ACP agent could not be reached. Check that it is installed and available on PATH.';
}

function contentText(content: ContentBlock | undefined): string {
  if (!content) return '';
  switch (content.type) {
    case 'text':
      return content.text;
    case 'resource_link':
      return content.title ?? content.name ?? content.uri;
    case 'resource':
      return content.resource.uri;
    default:
      return `[${content.type}]`;
  }
}

function toolDetail(
  content: ToolCallContent[] | null | undefined,
): string | undefined {
  if (!content || content.length === 0) return undefined;
  const parts = content
    .map((part) => {
      switch (part.type) {
        case 'content':
          return contentText(part.content);
        case 'diff':
          return `Diff · ${part.path}`;
        case 'terminal':
          return `Terminal · ${part.terminalId}`;
        default:
          return '';
      }
    })
    .filter((text): text is string => Boolean(text));
  return parts.length > 0 ? parts.join('\n') : undefined;
}

function applyToolUpdate(
  previous: AcpChatMessage[],
  update: ToolCallUpdate,
  nextId: () => string,
): AcpChatMessage[] {
  const index = previous.findIndex(
    (message) =>
      message.role === 'tool' && message.toolCallId === update.toolCallId,
  );
  if (index === -1) {
    return [
      ...previous,
      {
        id: nextId(),
        role: 'tool',
        toolCallId: update.toolCallId,
        title: update.title ?? 'Tool call',
        name: update.name ?? undefined,
        status: update.status ?? undefined,
        kind: update.kind ?? undefined,
        detail: toolDetail(update.content),
        locations: update.locations ?? undefined,
        rawInput:
          update.rawInput !== undefined && update.rawInput !== null
            ? update.rawInput
            : undefined,
        rawOutput:
          update.rawOutput !== undefined && update.rawOutput !== null
            ? update.rawOutput
            : undefined,
      },
    ];
  }

  const existing = previous[index];
  if (existing.role !== 'tool') return previous;
  const next: AcpChatMessage = {
    ...existing,
    title: update.title ?? existing.title,
    name: update.name ?? existing.name,
    status: update.status ?? existing.status,
    kind: update.kind ?? existing.kind,
    detail:
      update.content != null ? toolDetail(update.content) : existing.detail,
    locations:
      update.locations != null
        ? (update.locations as ToolCallLocation[])
        : existing.locations,
    rawInput:
      update.rawInput !== undefined && update.rawInput !== null
        ? update.rawInput
        : existing.rawInput,
    rawOutput:
      update.rawOutput !== undefined && update.rawOutput !== null
        ? update.rawOutput
        : existing.rawOutput,
  };
  return [...previous.slice(0, index), next, ...previous.slice(index + 1)];
}

function applyToolProcessingResult(
  previous: AcpChatMessage[],
  result: AcpToolProcessingResult,
  nextId: () => string,
): AcpChatMessage[] {
  const index = previous.findIndex(
    (message) =>
      message.role === 'tool' && message.toolCallId === result.toolCallId,
  );
  if (index === -1) {
    return [
      ...previous,
      {
        id: nextId(),
        role: 'tool',
        toolCallId: result.toolCallId,
        title: 'Tool call',
        processing: result.outcome,
        highlightPaths: result.highlightPaths,
        highlightItems: result.highlightItems,
      },
    ];
  }

  const existing = previous[index];
  if (existing.role !== 'tool') return previous;
  const highlightItemsByPath = new Map(
    [...(existing.highlightItems ?? []), ...(result.highlightItems ?? [])].map(
      (item) => [item.path, item],
    ),
  );
  const next: AcpChatMessage = {
    ...existing,
    processing: result.outcome,
    highlightPaths: [
      ...new Set([
        ...(existing.highlightPaths ?? []),
        ...(result.highlightPaths ?? []),
        ...[...highlightItemsByPath.keys()],
      ]),
    ],
    highlightItems:
      highlightItemsByPath.size > 0
        ? [...highlightItemsByPath.values()]
        : existing.highlightItems,
  };
  return [...previous.slice(0, index), next, ...previous.slice(index + 1)];
}

function applyUpdate(
  previous: AcpChatMessage[],
  update: SessionUpdate,
  nextId: () => string,
): AcpChatMessage[] {
  switch (update.sessionUpdate) {
    case 'user_message_chunk': {
      const text = contentText(update.content);
      if (!text) return previous;
      const last = previous[previous.length - 1];
      const protocolMessageId = update.messageId ?? undefined;
      if (
        last?.role === 'user' &&
        (!protocolMessageId || last.protocolMessageId === protocolMessageId)
      ) {
        return [...previous.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [
        ...previous,
        {
          id: nextId(),
          role: 'user',
          text,
          protocolMessageId,
        },
      ];
    }
    case 'agent_message_chunk': {
      const text = contentText(update.content);
      if (!text) return previous;
      const last = previous[previous.length - 1];
      const protocolMessageId = update.messageId ?? undefined;
      if (
        last?.role === 'agent' &&
        (!protocolMessageId || last.protocolMessageId === protocolMessageId)
      ) {
        return [...previous.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [
        ...previous,
        { id: nextId(), role: 'agent', text, protocolMessageId },
      ];
    }
    case 'agent_thought_chunk': {
      const text = contentText(update.content);
      if (!text) return previous;
      const last = previous[previous.length - 1];
      const protocolMessageId = update.messageId ?? undefined;
      if (
        last?.role === 'thought' &&
        (!protocolMessageId || last.protocolMessageId === protocolMessageId)
      ) {
        return [...previous.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [
        ...previous,
        { id: nextId(), role: 'thought', text, protocolMessageId },
      ];
    }
    case 'tool_call':
      return applyToolUpdate(previous, update as ToolCallUpdate, nextId);
    case 'tool_call_update':
      return applyToolUpdate(previous, update as ToolCallUpdate, nextId);
    case 'plan': {
      const text = update.entries
        .map((entry) => `• [${entry.status}] ${entry.content}`)
        .join('\n');
      return [
        ...previous,
        { id: nextId(), role: 'notice', text: `Plan\n${text}` },
      ];
    }
    case 'notice':
      return [
        ...previous,
        {
          id: nextId(),
          role: 'notice',
          text: [update.title, update.description]
            .filter((part): part is string => Boolean(part))
            .join(' — '),
          level: update.severity,
        },
      ];
    default:
      return previous;
  }
}

export function ACPStartupView({
  tab,
  state,
  error,
  hasAttemptedConnection,
  isStartingSession,
  pendingArtifactCount = 0,
  onInitialize,
  onStartSession,
  onStartFreshSession,
  onRetry,
  onAssociateArtifact = () => {},
}: {
  tab: AcpTab;
  state: ACPClientViewState;
  error?: string;
  hasAttemptedConnection: boolean;
  isStartingSession: boolean;
  pendingArtifactCount?: number;
  onInitialize: (agent: AcpAgentId) => void;
  onStartSession: () => void;
  onStartFreshSession: () => void;
  onRetry: () => void;
  onAssociateArtifact?: (artifact: AcpArtifactAssociation) => void;
}) {
  const { theme } = useTheme();
  const { isDragOver, dragHandlers } = useAcpArtifactDrop(onAssociateArtifact);
  const workspaceLabel = tab.repository
    ? `${tab.repository.owner} / ${tab.repository.name}`
    : tab.directory;
  const isDisconnected = state === 'setup' && hasAttemptedConnection;
  const isError = Boolean(error);
  const isStarting =
    state === 'initializing' ||
    isStartingSession ||
    (tab.autoStart && state === 'setup' && !hasAttemptedConnection);
  const canInitialize =
    state === 'setup' && !hasAttemptedConnection && !isStarting;
  const canStartSession = state === 'ready' && !isStartingSession;
  const detail = error
    ? error
    : isDisconnected
      ? 'Reconnect to continue in this workspace.'
      : isStarting
        ? undefined
        : canStartSession
          ? `Ready to start a session in ${workspaceLabel}.`
          : tab.sessionId
            ? `Reconnect to your saved session in ${workspaceLabel}.`
            : `Connect OpenCode to start a session in ${workspaceLabel}.`;

  return (
    <main
      className={`acp-session${isDragOver ? ' is-artifact-drop-active' : ''}`}
      aria-label="ACP agent session"
      style={getAcpThemeStyle(theme)}
      {...dragHandlers}
    >
      {isDragOver ? (
        <div className="acp-session__drop-overlay" role="status">
          Drop to queue for this session
        </div>
      ) : null}
      <header className="acp-session__topbar">
        <ACPWorkspaceIdentity sessionTitle={tab.sessionTitle} />
      </header>
      <div className="acp-session__messages">
        <div
          className="acp-session__empty"
          role={isError ? 'alert' : 'status'}
          aria-live="polite"
        >
          {isError ? (
            <XCircle size={18} />
          ) : isStarting ? (
            <FileCityLogoAnimated
              accent={theme.colors.accent}
              background="transparent"
              color={theme.colors.text}
              height={96}
              mark="P"
              primary={theme.colors.primary}
              width={96}
            />
          ) : null}
          <strong>
            {isError
              ? 'Could not start OpenCode'
              : isDisconnected
                ? 'OpenCode is disconnected'
                : isStarting
                  ? 'Connecting to OpenCode'
                  : canStartSession
                    ? 'OpenCode is connected'
                    : tab.sessionId
                      ? 'Reconnect to your OpenCode session'
                      : 'Start an OpenCode session'}
          </strong>
          {detail ? <span>{detail}</span> : null}
          {pendingArtifactCount > 0 ? (
            <span>
              {pendingArtifactCount} artifact
              {pendingArtifactCount === 1 ? '' : 's'} will be associated when
              the session starts.
            </span>
          ) : null}
          {isError || isDisconnected ? (
            <>
              <button
                className="acp-session__ghost-button acp-session__ghost-button--primary"
                onClick={onRetry}
                type="button"
              >
                {isError ? 'Try again' : 'Reconnect'}
              </button>
              {isError && tab.sessionId ? (
                <button
                  className="acp-session__ghost-button"
                  onClick={onStartFreshSession}
                  type="button"
                >
                  Start a fresh session
                </button>
              ) : null}
            </>
          ) : canInitialize ? (
            <button
              className="acp-session__ghost-button acp-session__ghost-button--primary"
              onClick={() => onInitialize(DEFAULT_ACP_AGENT)}
              type="button"
            >
              Connect OpenCode
            </button>
          ) : canStartSession ? (
            <button
              className="acp-session__ghost-button acp-session__ghost-button--primary"
              onClick={onStartSession}
              type="button"
            >
              {tab.sessionId ? 'Reconnect session' : 'Start a session'}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export function ACPTabContent({
  tab,
  isActive = true,
  onSessionIdChange,
  onSessionTitleChange,
  onPullRequestChange,
}: ACPTabContentProps) {
  const [viewState, setViewState] = useState<ACPClientViewState>('setup');
  const [agentId, setAgentId] = useState<AcpAgentId>(
    tab.agent ?? DEFAULT_ACP_AGENT,
  );
  const [error, setError] = useState<string | undefined>();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AcpChatMessage[]>([]);
  const [permissions, setPermissions] = useState<AcpPendingPermission[]>([]);
  const [isPrompting, setIsPrompting] = useState(false);
  const [artifacts, setArtifacts] = useState<AcpArtifactAssociation[]>([]);
  const [pendingArtifacts, setPendingArtifacts] = useState<
    AcpArtifactAssociation[]
  >([]);
  const [modelSelection, setModelSelection] = useState<
    AcpModelSelection | undefined
  >();
  const [modelError, setModelError] = useState<string | undefined>();
  const [hideThinking, setHideThinking] = useState(true);

  const messageIdRef = useRef(0);
  const generationRef = useRef(0);
  const autoStartedRef = useRef(false);
  const manualStopRef = useRef(false);
  const isPromptingRef = useRef(false);
  const artifactsRef = useRef<AcpArtifactAssociation[]>([]);
  const pendingArtifactsRef = useRef<AcpArtifactAssociation[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const artifactMutationRef = useRef(0);

  const nextMessageId = useCallback(
    () => `acp-message-${++messageIdRef.current}`,
    [],
  );

  const applyArtifacts = useCallback((next: AcpArtifactAssociation[]) => {
    artifactsRef.current = next;
    setArtifacts(next);
  }, []);

  const applyPendingArtifacts = useCallback(
    (next: AcpArtifactAssociation[]) => {
      pendingArtifactsRef.current = next;
      setPendingArtifacts(next);
    },
    [],
  );

  const addNotice = useCallback(
    (text: string, level: 'info' | 'error' = 'error') => {
      setMessages((previous) => [
        ...previous,
        { id: nextMessageId(), role: 'notice', text, level },
      ]);
    },
    [nextMessageId],
  );

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // "Hide thinking" is a persisted ACP preference so the setting follows the
  // user across tabs and sessions.
  useEffect(() => {
    let isMounted = true;
    const apply = (preferences: { acpHideThinking?: boolean }) => {
      // Hidden unless the user explicitly opted into showing thought text.
      if (isMounted) setHideThinking(preferences.acpHideThinking !== false);
    };
    void UserPreferencesService.getPreferences().then(apply);
    const unsubscribe = UserPreferencesService.onPreferencesUpdated(apply);
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const toggleHideThinking = useCallback(() => {
    const next = !hideThinking;
    setHideThinking(next);
    void UserPreferencesService.updatePreferences({
      acpHideThinking: next,
    });
  }, [hideThinking]);

  const agent = getAcpAgent(agentId);

  const linkPullRequest = useCallback(
    (pullRequest: AcpLinkedPullRequest) => {
      onPullRequestChange?.(pullRequest);
    },
    [onPullRequestChange],
  );

  const unlinkPullRequest = useCallback(() => {
    onPullRequestChange?.(null);
  }, [onPullRequestChange]);

  const setPrompting = useCallback((value: boolean) => {
    isPromptingRef.current = value;
    setIsPrompting(value);
  }, []);

  // Session events for this tab. Subscriptions are keyed by the tab id so two
  // open ACP tabs never consume each other's updates.
  useEffect(() => {
    try {
      return AcpService.onSessionEvent(({ sessionKey, event }) => {
        if (sessionKey !== tab.id) return;

        if (event.type === 'update') {
          if (event.update.sessionUpdate === 'session_info_update') {
            if (event.update.title !== undefined) {
              onSessionTitleChange?.(event.update.title);
            }
            return;
          }
          if (event.update.sessionUpdate === 'config_option_update') {
            const model = normalizeAcpModelSelection(
              event.update.configOptions,
            );
            if (model) setModelSelection(model);
            return;
          }
          setMessages((previous) =>
            applyUpdate(previous, event.update, nextMessageId),
          );
          return;
        }

        if (event.type === 'tool-processing') {
          setMessages((previous) =>
            applyToolProcessingResult(previous, event.result, nextMessageId),
          );
          return;
        }

        if (event.type === 'permission') {
          setPermissions((previous) =>
            previous.some((entry) => entry.requestId === event.requestId)
              ? previous
              : [
                  ...previous,
                  { requestId: event.requestId, request: event.request },
                ],
          );
          return;
        }

        // A closed connection ends the tab's live session. Manual disconnects
        // are already resetting the view, so only surface unexpected closes.
        if (manualStopRef.current) return;
        setPrompting(false);
        setPermissions([]);
        setSessionId(null);
        sessionIdRef.current = null;
        setError(event.reason ?? 'The ACP connection closed.');
        setViewState('error');
      });
    } catch (subscriptionError) {
      console.error(
        '[ACP] Failed to subscribe to session events:',
        subscriptionError,
      );
      return () => {};
    }
  }, [nextMessageId, onSessionTitleChange, setPrompting, tab.id]);

  // Stop the child agent when the tab unmounts. The main process is the owner
  // of the process, so this is the only reliable cleanup point on tab close.
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      manualStopRef.current = true;
      void AcpService.disconnect(tab.id).catch(() => {});
    };
  }, [tab.id]);

  const connect = useCallback(
    async (nextAgent: AcpAgentId): Promise<boolean> => {
      const generation = ++generationRef.current;
      autoStartedRef.current = true;
      manualStopRef.current = false;
      setAgentId(nextAgent);
      setError(undefined);
      setViewState('initializing');
      setSessionId(null);
      sessionIdRef.current = null;
      setMessages([]);
      setPermissions([]);
      setPrompting(false);
      setIsStartingSession(false);
      setModelSelection(undefined);
      setModelError(undefined);

      try {
        await AcpService.connect({
          sessionKey: tab.id,
          directory: tab.directory,
          agent: nextAgent,
        });
        if (generation !== generationRef.current) return false;
        setViewState('ready');
        return true;
      } catch (connectError) {
        if (generation !== generationRef.current) return false;
        setError(formatError(connectError));
        setViewState('error');
        return false;
      }
    },
    [setPrompting, tab.directory, tab.id],
  );

  const startSession = useCallback(
    async (restoreSavedSession = true): Promise<boolean> => {
      const generation = generationRef.current;
      setIsStartingSession(true);
      setError(undefined);
      setModelError(undefined);
      try {
        const result =
          tab.sessionId && restoreSavedSession
            ? await AcpService.loadSession({
                sessionKey: tab.id,
                sessionId: tab.sessionId,
              })
            : await AcpService.newSession({
                sessionKey: tab.id,
                ...(modelSelection?.currentValue
                  ? { model: modelSelection.currentValue }
                  : {}),
              });
        if (generation !== generationRef.current) return false;
        const pending = pendingArtifactsRef.current;
        const merged = dedupeAcpArtifacts([
          ...(result.artifacts ?? []),
          ...pending,
        ]);
        sessionIdRef.current = result.sessionId;
        setSessionId(result.sessionId);
        const revision = ++artifactMutationRef.current;
        applyArtifacts(merged);
        setModelSelection(result.model);
        onSessionIdChange?.(result.sessionId);
        setViewState('ready');

        if (pending.length > 0) {
          applyPendingArtifacts([]);
          try {
            const saved = await AcpService.setSessionArtifacts({
              sessionKey: tab.id,
              artifacts: merged,
            });
            if (
              generation === generationRef.current &&
              artifactMutationRef.current === revision
            ) {
              applyArtifacts(saved.artifacts);
            }
          } catch (artifactError) {
            if (generation === generationRef.current) {
              addNotice(formatError(artifactError));
            }
          }
        }
        return true;
      } catch (sessionError) {
        if (generation !== generationRef.current) return false;
        setError(formatError(sessionError));
        setViewState('error');
        return false;
      } finally {
        if (generation === generationRef.current) {
          setIsStartingSession(false);
        }
      }
    },
    [
      addNotice,
      applyArtifacts,
      applyPendingArtifacts,
      modelSelection?.currentValue,
      onSessionIdChange,
      tab.id,
      tab.sessionId,
    ],
  );

  const changeModel = useCallback(
    async (model: string) => {
      const previous = modelSelection;
      if (!previous || previous.currentValue === model) return;
      setModelError(undefined);
      // Respond to the select immediately; revert if the agent rejects it.
      setModelSelection({ ...previous, currentValue: model });
      try {
        const result = await AcpService.setModel({
          sessionKey: tab.id,
          model,
        });
        setModelSelection(result.model);
      } catch (modelChangeError) {
        setModelSelection(previous);
        setModelError(formatError(modelChangeError));
      }
    },
    [modelSelection, tab.id],
  );

  const associateArtifact = useCallback(
    async (artifact: AcpArtifactAssociation) => {
      const current = artifactsRef.current;
      const next = dedupeAcpArtifacts([...current, artifact]);
      if (!sessionIdRef.current) {
        // No live session yet: queue until the session starts, then persist it
        // under the agent session id.
        applyPendingArtifacts(
          dedupeAcpArtifacts([...pendingArtifactsRef.current, artifact]),
        );
        return;
      }
      if (next.length === current.length) return;

      const revision = ++artifactMutationRef.current;
      applyArtifacts(next);
      try {
        const result = await AcpService.setSessionArtifacts({
          sessionKey: tab.id,
          artifacts: next,
        });
        if (artifactMutationRef.current === revision) {
          applyArtifacts(result.artifacts);
        }
      } catch (error) {
        if (artifactMutationRef.current === revision) {
          applyArtifacts(current);
        }
        addNotice(formatError(error));
      }
    },
    [addNotice, applyArtifacts, applyPendingArtifacts, tab.id],
  );

  const removeArtifact = useCallback(
    async (artifact: AcpArtifactAssociation) => {
      const key = acpArtifactKey(artifact);
      if (!sessionIdRef.current) {
        applyPendingArtifacts(
          pendingArtifactsRef.current.filter(
            (candidate) => acpArtifactKey(candidate) !== key,
          ),
        );
        return;
      }

      const current = artifactsRef.current;
      const next = current.filter(
        (candidate) => acpArtifactKey(candidate) !== key,
      );
      if (next.length === current.length) return;

      const revision = ++artifactMutationRef.current;
      applyArtifacts(next);
      try {
        const result = await AcpService.setSessionArtifacts({
          sessionKey: tab.id,
          artifacts: next,
        });
        if (artifactMutationRef.current === revision) {
          applyArtifacts(result.artifacts);
        }
      } catch (error) {
        if (artifactMutationRef.current === revision) {
          applyArtifacts(current);
        }
        addNotice(formatError(error));
      }
    },
    [addNotice, applyArtifacts, applyPendingArtifacts, tab.id],
  );

  // Quick Open starts a new session automatically. Restored tabs with a saved
  // session ID reconnect and load that session; other restored tabs stay on setup.
  useEffect(() => {
    if ((!tab.autoStart && !tab.sessionId) || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void (async () => {
      const connected = await connect(agentId);
      if (connected) await startSession();
    })();
  }, [agentId, connect, startSession, tab.autoStart, tab.sessionId]);

  const retry = useCallback(async () => {
    const connected = await connect(agentId);
    if (connected) await startSession();
  }, [agentId, connect, startSession]);

  const startFreshSession = useCallback(async () => {
    const connected = await connect(agentId);
    if (connected) await startSession(false);
  }, [agentId, connect, startSession]);

  const send = useCallback(
    async (
      text: string,
      reference?: AcpChatReference,
      stagedArtifacts?: AcpArtifactAssociation[],
    ) => {
      if (isPromptingRef.current) return;
      setPrompting(true);
      setMessages((previous) => [
        ...previous,
        { id: nextMessageId(), role: 'user', text, reference },
      ]);
      const quotedReference = !reference
        ? ''
        : isAcpTopicReference(reference)
          ? [
              `User-selected reference from topic "${reference.topicTitle}" (topic id: ${reference.topicId}); treat it as quoted source context:`,
              ...reference.anchor.exact
                .split(/\r\n|\r|\n/)
                .map((line) => `> ${line}`),
            ].join('\n')
          : isAcpModelReference(reference)
            ? [
                `User-selected reference from subsystem model "${reference.modelTitle}" trail "${reference.trailTitle}"${reference.stepIndex === undefined ? '' : `, step ${reference.stepIndex + 1}`} (model id: ${reference.modelId}, trail id: ${reference.trailId}); treat it as quoted source context:`,
                ...reference.stepSummary
                  .split(/\r\n|\r|\n/)
                  .map((line) => `> ${line}`),
              ].join('\n')
            : [
                `User-selected reference from drawing "${reference.drawingName}" (drawing id: ${reference.drawingId}, ${reference.elementIds.length} element${reference.elementIds.length === 1 ? '' : 's'}); treat it as quoted source context:`,
                ...reference.elementSummary
                  .split(/\r\n|\r|\n/)
                  .map((line) => `> ${line}`),
              ].join('\n');
      const promptText = quotedReference
        ? `${text}\n\n${quotedReference}`
        : text;
      try {
        if (stagedArtifacts && stagedArtifacts.length > 0) {
          await AcpService.prompt(tab.id, promptText, stagedArtifacts);
        } else {
          await AcpService.prompt(tab.id, promptText);
        }
      } catch (promptError) {
        setMessages((previous) => [
          ...previous,
          {
            id: nextMessageId(),
            role: 'notice',
            text: formatError(promptError),
            level: 'error',
          },
        ]);
      } finally {
        setPrompting(false);
        setPermissions([]);
      }
    },
    [nextMessageId, setPrompting, tab.id],
  );

  const stop = useCallback(() => {
    setPermissions([]);
    void AcpService.cancel(tab.id).catch((cancelError) => {
      console.error('[ACP] Failed to cancel prompt:', cancelError);
    });
  }, [tab.id]);

  const respondPermission = useCallback(
    (requestId: string, optionId: string | null) => {
      setPermissions((previous) =>
        previous.filter((entry) => entry.requestId !== requestId),
      );
      void AcpService.respondPermission({
        sessionKey: tab.id,
        requestId,
        optionId,
      }).catch((permissionError) => {
        console.error(
          '[ACP] Failed to answer permission request:',
          permissionError,
        );
      });
    },
    [tab.id],
  );

  if (sessionId) {
    return (
      <ACPSessionView
        agent={agent}
        workspacePath={tab.directory}
        repository={tab.repository}
        sessionTitle={tab.sessionTitle}
        messages={messages}
        permissions={permissions}
        isPrompting={isPrompting}
        isActive={isActive}
        hideThinking={hideThinking}
        modelSelection={modelSelection}
        modelError={modelError}
        sessionArtifacts={artifacts}
        pullRequest={tab.pullRequest}
        onLinkPullRequest={linkPullRequest}
        onUnlinkPullRequest={unlinkPullRequest}
        onModelChange={(model) => void changeModel(model)}
        onToggleHideThinking={toggleHideThinking}
        onAssociateArtifact={(artifact) => void associateArtifact(artifact)}
        onRemoveArtifact={(artifact) => void removeArtifact(artifact)}
        onSend={(text, reference, stagedArtifacts) =>
          void send(text, reference, stagedArtifacts)
        }
        onStop={stop}
        onRespondPermission={respondPermission}
      />
    );
  }

  // Keep the agent-picker screen out of the tab flow. OpenCode is the current
  // supported agent; the reusable picker component remains available for when
  // additional agents are supported.
  return (
    <ACPStartupView
      tab={tab}
      state={viewState}
      error={error}
      hasAttemptedConnection={autoStartedRef.current}
      isStartingSession={isStartingSession}
      pendingArtifactCount={pendingArtifacts.length}
      onInitialize={(nextAgent) => void connect(nextAgent)}
      onStartSession={() => void startSession()}
      onStartFreshSession={() => void startFreshSession()}
      onRetry={() => void retry()}
      onAssociateArtifact={(artifact) => void associateArtifact(artifact)}
    />
  );
}

export default ACPTabContent;
