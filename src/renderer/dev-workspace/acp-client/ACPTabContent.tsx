import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, XCircle } from 'lucide-react';
import type {
  ContentBlock,
  SessionUpdate,
  ToolCall,
  ToolCallContent,
  ToolCallUpdate,
} from '@agentclientprotocol/sdk';
import {
  DEFAULT_ACP_AGENT,
  getAcpAgent,
  type AcpAgentId,
} from '../../../shared/main-process-api-interfaces/AcpAPI';
import type { AcpTab } from '../../events/portalTabs';
import { AcpService } from '../../main-process-api/AcpService';
import type { ACPClientViewState } from './ACPClientView';
import { ACPWorkspaceIdentity } from './ACPWorkspaceIdentity';
import {
  ACPSessionView,
  type AcpChatMessage,
  type AcpPendingPermission,
} from './ACPSessionView';
import './ACPClientView.css';

export interface ACPTabContentProps {
  tab: AcpTab;
  onSessionIdChange?: (sessionId: string) => void;
  onSessionTitleChange?: (title: string | null) => void;
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

function toolMessage(call: ToolCall, id: string): AcpChatMessage {
  return {
    id,
    role: 'tool',
    toolCallId: call.toolCallId,
    title: call.title,
    status: call.status,
    kind: call.kind,
    detail: toolDetail(call.content),
  };
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
        status: update.status ?? undefined,
        kind: update.kind ?? undefined,
        detail: toolDetail(update.content),
      },
    ];
  }

  const existing = previous[index];
  if (existing.role !== 'tool') return previous;
  const next: AcpChatMessage = {
    ...existing,
    title: update.title ?? existing.title,
    status: update.status ?? existing.status,
    kind: update.kind ?? existing.kind,
    detail:
      update.content != null
        ? toolDetail(update.content)
        : existing.detail,
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
        return [
          ...previous.slice(0, -1),
          { ...last, text: last.text + text },
        ];
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
        return [
          ...previous.slice(0, -1),
          { ...last, text: last.text + text },
        ];
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
        return [
          ...previous.slice(0, -1),
          { ...last, text: last.text + text },
        ];
      }
      return [
        ...previous,
        { id: nextId(), role: 'thought', text, protocolMessageId },
      ];
    }
    case 'tool_call':
      return [
        ...previous,
        toolMessage(update as ToolCall, nextId()),
      ];
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

function ACPStartupView({
  tab,
  state,
  error,
  hasAttemptedConnection,
  isStartingSession,
  onInitialize,
  onStartSession,
  onStartFreshSession,
  onRetry,
}: {
  tab: AcpTab;
  state: ACPClientViewState;
  error?: string;
  hasAttemptedConnection: boolean;
  isStartingSession: boolean;
  onInitialize: (agent: AcpAgentId) => void;
  onStartSession: () => void;
  onStartFreshSession: () => void;
  onRetry: () => void;
}) {
  const workspaceLabel = tab.repository
    ? `${tab.repository.owner} / ${tab.repository.name}`
    : tab.directory;
  const isDisconnected = state === 'setup' && hasAttemptedConnection;
  const canInitialize = state === 'setup' && !hasAttemptedConnection;
  const canStartSession = state === 'ready' && !isStartingSession;
  const isError = Boolean(error);
  const isStarting =
    state === 'initializing' ||
    isStartingSession ||
    (tab.autoStart && state === 'setup' && !hasAttemptedConnection);
  const status = isError
    ? 'Connection failed'
    : isDisconnected
      ? 'Disconnected'
      : isStarting
        ? 'Connecting'
        : canStartSession
          ? 'Connected'
          : 'Not connected';

  return (
    <main className="acp-session" aria-label="ACP agent session">
      <header className="acp-session__topbar">
        <ACPWorkspaceIdentity
          workspacePath={tab.directory}
          repository={tab.repository}
        />
        <span
          className={`acp-client__connection acp-client__connection--${isError ? 'error' : state}`}
        >
          <span className="acp-client__connection-dot" />
          {status}
        </span>
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
            <Loader2 className="acp-client__spinning" size={18} />
          ) : (
            <Sparkles size={18} />
          )}
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
          <span>
            {error ??
              (isDisconnected
                ? 'Reconnect to continue in this workspace.'
                : isStarting
                  ? `Preparing an OpenCode session in ${workspaceLabel}.`
                  : canStartSession
                    ? `Ready to start a session in ${workspaceLabel}.`
                    : tab.sessionId
                      ? `Reconnect to your saved session in ${workspaceLabel}.`
                      : `Connect OpenCode to start a session in ${workspaceLabel}.`)}
          </span>
          {isError || isDisconnected ? (
            <>
              <button
                className="acp-session__ghost-button"
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
              className="acp-session__ghost-button"
              onClick={() => onInitialize(DEFAULT_ACP_AGENT)}
              type="button"
            >
              Connect OpenCode
            </button>
          ) : canStartSession ? (
            <button
              className="acp-session__ghost-button"
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
  onSessionIdChange,
  onSessionTitleChange,
}: ACPTabContentProps) {
  const [viewState, setViewState] =
    useState<ACPClientViewState>('setup');
  const [agentId, setAgentId] = useState<AcpAgentId>(
    tab.agent ?? DEFAULT_ACP_AGENT,
  );
  const [error, setError] = useState<string | undefined>();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AcpChatMessage[]>([]);
  const [permissions, setPermissions] = useState<AcpPendingPermission[]>([]);
  const [isPrompting, setIsPrompting] = useState(false);

  const messageIdRef = useRef(0);
  const generationRef = useRef(0);
  const autoStartedRef = useRef(false);
  const manualStopRef = useRef(false);
  const isPromptingRef = useRef(false);

  const nextMessageId = useCallback(
    () => `acp-message-${++messageIdRef.current}`,
    [],
  );

  const agent = getAcpAgent(agentId);

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
          setMessages((previous) =>
            applyUpdate(previous, event.update, nextMessageId),
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
        setError(event.reason ?? 'The ACP connection closed.');
        setViewState('error');
      });
    } catch (subscriptionError) {
      console.error('[ACP] Failed to subscribe to session events:', subscriptionError);
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
      setMessages([]);
      setPermissions([]);
      setPrompting(false);
      setIsStartingSession(false);

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
      try {
        const result =
          tab.sessionId && restoreSavedSession
            ? await AcpService.loadSession({
                sessionKey: tab.id,
                sessionId: tab.sessionId,
              })
            : await AcpService.newSession(tab.id);
        if (generation !== generationRef.current) return false;
        setSessionId(result.sessionId);
        onSessionIdChange?.(result.sessionId);
        setViewState('ready');
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
    [onSessionIdChange, tab.id, tab.sessionId],
  );

  // Quick Open opens an ACP tab with `autoStart`, so land directly in a live
  // session. Restored tabs never carry `autoStart`, so they stay on setup.
  useEffect(() => {
    if (!tab.autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void (async () => {
      const connected = await connect(agentId);
      if (connected) await startSession();
    })();
  }, [agentId, connect, startSession, tab.autoStart]);

  const retry = useCallback(async () => {
    const connected = await connect(agentId);
    if (connected) await startSession();
  }, [agentId, connect, startSession]);

  const startFreshSession = useCallback(async () => {
    const connected = await connect(agentId);
    if (connected) await startSession(false);
  }, [agentId, connect, startSession]);

  const disconnect = useCallback(async () => {
    generationRef.current += 1;
    manualStopRef.current = true;
    autoStartedRef.current = true;
    try {
      await AcpService.disconnect(tab.id);
    } catch (disconnectError) {
      console.error('[ACP] Failed to disconnect agent:', disconnectError);
    }
    setSessionId(null);
    setMessages([]);
    setPermissions([]);
    setPrompting(false);
    setIsStartingSession(false);
    setError(undefined);
    setViewState('setup');
  }, [setPrompting, tab.id]);

  const send = useCallback(
    async (text: string) => {
      if (isPromptingRef.current) return;
      setPrompting(true);
      setMessages((previous) => [
        ...previous,
        { id: nextMessageId(), role: 'user', text },
      ]);
      try {
        await AcpService.prompt(tab.id, text);
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
        console.error('[ACP] Failed to answer permission request:', permissionError);
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
        messages={messages}
        permissions={permissions}
        isPrompting={isPrompting}
        onSend={(text) => void send(text)}
        onStop={stop}
        onRespondPermission={respondPermission}
        onDisconnect={() => void disconnect()}
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
      onInitialize={(nextAgent) => void connect(nextAgent)}
      onStartSession={() => void startSession()}
      onStartFreshSession={() => void startFreshSession()}
      onRetry={() => void retry()}
    />
  );
}

export default ACPTabContent;
