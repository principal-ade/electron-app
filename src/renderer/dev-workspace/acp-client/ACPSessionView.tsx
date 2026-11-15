import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  ShieldQuestion,
  Sparkles,
  Square,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/file-city-react';
import type {
  RequestPermissionRequest,
  ToolCallLocation,
} from '@agentclientprotocol/sdk';
import type {
  AcpAgentDefinition,
  AcpToolProcessingOutcome,
} from '../../../shared/main-process-api-interfaces/AcpAPI';
import { StreamdownMarkdown } from '../../components/StreamdownMarkdown';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { useRepoWatch } from '../../panels/home-panel/useRepoWatch';
import { gitStatusToHighlightLayers } from '../../utils/gitStatusHighlightLayers';
import { buildCityDataFromContext } from '../file-city-panel/buildCityDataFromContext';
import { ACPWorkspaceIdentity } from './ACPWorkspaceIdentity';

export type AcpChatMessage =
  | {
      id: string;
      role: 'user' | 'agent' | 'thought';
      text: string;
      protocolMessageId?: string;
    }
  | {
      id: string;
      role: 'tool';
      toolCallId: string;
      title: string;
      name?: string;
      status?: string;
      kind?: string;
      detail?: string;
      locations?: ToolCallLocation[];
      highlightPaths?: string[];
      rawInput?: unknown;
      rawOutput?: unknown;
      processing?: AcpToolProcessingOutcome;
    }
  | { id: string; role: 'notice'; text: string; level?: string };

export interface AcpPendingPermission {
  requestId: string;
  request: RequestPermissionRequest;
}

export interface ACPSessionViewProps {
  agent: AcpAgentDefinition;
  workspacePath: string;
  repository?: {
    owner: string;
    name: string;
    avatarUrl?: string;
  };
  messages: AcpChatMessage[];
  permissions: AcpPendingPermission[];
  isPrompting: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onRespondPermission: (requestId: string, optionId: string | null) => void;
  onDisconnect: () => void;
}

function toolStatusIcon(status?: string) {
  if (status === 'completed') return <CheckCircle2 size={13} />;
  if (status === 'failed') return <XCircle size={13} />;
  if (status === 'in_progress') {
    return <Loader2 className="acp-client__spinning" size={13} />;
  }
  return <Wrench size={13} />;
}

function toolStatusLabel(status?: string): string {
  return (status ?? 'pending').replace('_', ' ');
}

function toolInputSummary(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function toolProcessingLabel(outcome?: AcpToolProcessingOutcome): string {
  switch (outcome) {
    case 'highlighted':
      return 'Highlighted';
    case 'already-highlighted':
      return 'Already highlighted';
    case 'no-file-paths':
      return 'No file paths';
    case 'no-repository':
      return 'Outside repository';
    case 'unavailable':
      return 'Processor unavailable';
    case 'failed':
      return 'Processing failed';
    default:
      return 'Map pending';
  }
}

function ACPToolCallsPanel({
  calls,
  workspacePath,
}: {
  calls: AcpChatMessage[];
  workspacePath: string;
}) {
  const toolCalls = calls.filter(
    (message): message is Extract<AcpChatMessage, { role: 'tool' }> =>
      message.role === 'tool',
  );
  const activeCount = toolCalls.filter(
    (call) => call.status === 'in_progress' || call.status === 'pending',
  ).length;
  const highlightLayers = useMemo<HighlightLayer[]>(() => {
    const operationColors: Record<string, string> = {
      read: '#3b82f6',
      edit: '#f59e0b',
      write: '#22c55e',
      delete: '#ef4444',
      move: '#f97316',
      search: '#8b5cf6',
      execute: '#6b7280',
    };
    return toolCalls.slice(-40).flatMap((call) => {
      const paths = [...new Set(call.highlightPaths ?? [])];
      if (paths.length === 0) return [];
      return [
        {
          id: `acp-tool-call-${call.toolCallId}`,
          name: call.title,
          enabled: true,
          color: operationColors[call.kind ?? ''] ?? '#6b7280',
          opacity: 0.82,
          priority: 80,
          items: paths.map((path) => ({
            path,
            type: 'file' as const,
            renderStrategy:
              call.status === 'in_progress'
                ? ('border' as const)
                : ('fill' as const),
          })),
        },
      ];
    });
  }, [toolCalls]);
  return (
    <aside className="acp-session__tool-panel" aria-label="ACP activity">
      <header className="acp-session__tool-panel-header">
        <div>
          <span className="acp-session__section-kicker">ACP WORKSPACE</span>
          <strong className="acp-session__tool-panel-title">
            Tool activity
          </strong>
        </div>
        <span
          className="acp-session__tool-count"
          aria-label={`${toolCalls.length} tool calls`}
        >
          {toolCalls.length}
        </span>
      </header>

      <div className="acp-session__tool-panel-content">
        <div className="acp-session__tool-activity">
          {toolCalls.length === 0 ? (
            <div className="acp-session__tool-panel-empty" role="status">
              <Circle size={14} />
              <span>Tool calls will appear here as the agent works.</span>
            </div>
          ) : (
            <ol className="acp-session__tool-list" aria-live="polite">
              {toolCalls.map((call) => {
                const input = toolInputSummary(call.rawInput);
                const output = toolInputSummary(call.rawOutput);
                return (
                  <li className="acp-session__tool-card" key={call.id}>
                    <details className="acp-session__tool-disclosure">
                      <summary className="acp-session__tool-card-summary">
                        <div className="acp-session__tool-card-heading">
                          <span
                            className={`acp-session__tool-icon acp-session__tool-icon--${call.status ?? 'pending'}`}
                            aria-hidden="true"
                          >
                            {toolStatusIcon(call.status)}
                          </span>
                          <span className="acp-session__tool-card-title">
                            {call.title}
                          </span>
                          <ChevronRight
                            className="acp-session__tool-disclosure-icon"
                            size={13}
                            aria-hidden="true"
                          />
                        </div>
                        <div className="acp-session__tool-card-meta">
                          {call.name ? <code>{call.name}</code> : null}
                          {call.kind ? <span>{call.kind}</span> : null}
                          <span className="acp-session__tool-card-status">
                            {toolStatusLabel(call.status)}
                            {call.status === 'in_progress' ? (
                              <Loader2
                                className="acp-client__spinning"
                                size={11}
                                aria-hidden="true"
                              />
                            ) : null}
                          </span>
                          <span
                            className={`acp-session__tool-processing acp-session__tool-processing--${call.processing ?? 'pending'}`}
                            title="Result of sending this tool call through the file-highlighting pipeline"
                          >
                            {toolProcessingLabel(call.processing)}
                          </span>
                        </div>
                      </summary>
                      <div className="acp-session__tool-card-body">
                        {call.locations && call.locations.length > 0 ? (
                          <ul className="acp-session__tool-locations">
                            {call.locations.map((location) => (
                              <li
                                key={`${location.path}:${location.line ?? ''}`}
                              >
                                <code>{location.path}</code>
                                {location.line ? (
                                  <span>:{location.line}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {call.detail ? (
                          <pre className="acp-session__tool-detail">
                            {call.detail}
                          </pre>
                        ) : null}
                        {input ? (
                          <details className="acp-session__tool-input">
                            <summary>Input</summary>
                            <pre>{input}</pre>
                          </details>
                        ) : null}
                        {output ? (
                          <details className="acp-session__tool-input">
                            <summary>Output</summary>
                            <pre>{output}</pre>
                          </details>
                        ) : null}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
          {activeCount > 0 ? (
            <div className="acp-session__tool-panel-footer" role="status">
              <Loader2 className="acp-client__spinning" size={12} />
              {activeCount} active
            </div>
          ) : null}
        </div>
        <section
          className="acp-session__tool-city-section"
          aria-label="Workspace File City"
        >
          <h3 className="acp-session__tool-city-heading">
            <Building2 size={13} />
            Workspace File City
          </h3>
          <ACPFileCityView
            workspacePath={workspacePath}
            highlightLayers={highlightLayers}
          />
        </section>
      </div>
    </aside>
  );
}

function ACPFileCityView({
  workspacePath,
  highlightLayers,
}: {
  workspacePath: string;
  highlightLayers: HighlightLayer[];
}) {
  useRepoWatch(workspacePath);
  const { gitStatusWithFiles } = useRepositoryGitStatus(workspacePath);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gitHighlightLayers = useMemo(
    () =>
      gitStatusWithFiles
        ? gitStatusToHighlightLayers(gitStatusWithFiles, 'acp-git-status')
        : [],
    [gitStatusWithFiles],
  );
  const visibleHighlightLayers = useMemo(
    () => [...gitHighlightLayers, ...highlightLayers],
    [gitHighlightLayers, highlightLayers],
  );

  useEffect(() => {
    let cancelled = false;
    setCityData(null);
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const fileTree =
          await RepositoryMonitoringService.getFileTree(workspacePath);
        if (!fileTree) throw new Error('No file tree is available');
        const nextCityData = await buildCityDataFromContext({
          fileTree,
          repositoryPath: workspacePath,
        });
        if (!cancelled) setCityData(nextCityData);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load this workspace File City',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  if (!cityData) {
    return (
      <div className="acp-session__file-city">
        <div
          className="acp-session__tool-panel-empty"
          role={error ? 'alert' : 'status'}
        >
          <Building2 size={15} />
          <span>
            {isLoading
              ? 'Building this workspace File City…'
              : (error ?? 'File City is unavailable for this workspace.')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="acp-session__file-city">
      <div
        className="acp-session__git-legend"
        aria-label="Workspace git status"
        role="status"
      >
        {gitStatusWithFiles ? (
          gitHighlightLayers.length > 0 ? (
            gitHighlightLayers.map((layer) => (
              <span className="acp-session__git-legend-item" key={layer.id}>
                <span
                  className="acp-session__git-legend-swatch"
                  style={{ backgroundColor: layer.color }}
                  aria-hidden="true"
                />
                {layer.name}
              </span>
            ))
          ) : (
            <span className="acp-session__git-legend-clean">
              Working tree clean
            </span>
          )
        ) : (
          <span className="acp-session__git-legend-clean">
            Git status unavailable
          </span>
        )}
      </div>
      <ArchitectureMapHighlightLayers
        cityData={cityData}
        highlightLayers={visibleHighlightLayers}
        fullSize
        enableZoom
        canvasBackgroundColor="#ffffff"
        defaultBuildingColor="#f8f9fc"
      />
    </div>
  );
}

export function ACPSessionView({
  agent,
  workspacePath,
  repository,
  messages,
  permissions,
  isPrompting,
  onSend,
  onStop,
  onRespondPermission,
  onDisconnect,
}: ACPSessionViewProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, permissions, isPrompting]);

  useEffect(() => {
    if (!isPrompting) textareaRef.current?.focus();
  }, [isPrompting]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isPrompting) return;
    setDraft('');
    onSend(text);
  };
  const hasToolCalls = messages.some((message) => message.role === 'tool');
  const latestConversationMessage = [...messages]
    .reverse()
    .find((message) => message.role !== 'tool');
  const streamingAgentMessageId =
    isPrompting && latestConversationMessage?.role === 'agent'
      ? latestConversationMessage.id
      : undefined;

  return (
    <main className="acp-session" aria-label="ACP agent session">
      <header className="acp-session__topbar">
        <ACPWorkspaceIdentity
          workspacePath={workspacePath}
          repository={repository}
        />
        <div className="acp-session__topbar-right">
          <span className="acp-client__connection acp-client__connection--ready">
            <span className="acp-client__connection-dot" />
            Connected
          </span>
          <button
            className="acp-session__ghost-button"
            onClick={onDisconnect}
            type="button"
          >
            Disconnect
          </button>
        </div>
      </header>

      <div className="acp-session__workspace">
        <div className="acp-session__main">
          <div className="acp-session__messages" role="log" aria-live="polite">
            {messages.filter((message) => message.role !== 'tool').length ===
            0 ? (
              <div className="acp-session__empty">
                <Sparkles size={18} />
                <strong>
                  {hasToolCalls ? 'Agent is working' : 'Session ready'}
                </strong>
                <span>
                  {hasToolCalls
                    ? 'Live tool activity is listed in the panel.'
                    : `Ask ${agent.name} to explore, explain, or change something in this workspace.`}
                </span>
              </div>
            ) : null}

            {messages.map((message) => {
              switch (message.role) {
                case 'user':
                  return (
                    <div
                      className="acp-session__row acp-session__row--user"
                      key={message.id}
                    >
                      <div className="acp-session__bubble acp-session__bubble--user">
                        {message.text}
                      </div>
                    </div>
                  );
                case 'agent':
                  return (
                    <div className="acp-session__row" key={message.id}>
                      <div className="acp-session__bubble">
                        <span className="acp-session__role">{agent.name}</span>
                        <StreamdownMarkdown
                          className="acp-session__text"
                          streaming={message.id === streamingAgentMessageId}
                          text={message.text}
                        />
                      </div>
                    </div>
                  );
                case 'thought':
                  return (
                    <div className="acp-session__thought" key={message.id}>
                      <Sparkles size={12} />
                      <span>{message.text}</span>
                    </div>
                  );
                case 'tool':
                  return null;
                case 'notice':
                  return (
                    <div
                      className={`acp-session__notice acp-session__notice--${message.level ?? 'info'}`}
                      key={message.id}
                    >
                      {message.text}
                    </div>
                  );
                default:
                  return null;
              }
            })}

            <div ref={endRef} />
          </div>

          {permissions.length > 0 ? (
            <div className="acp-session__permissions">
              {permissions.map(({ requestId, request }) => (
                <div className="acp-session__permission" key={requestId}>
                  <div className="acp-session__permission-head">
                    <ShieldQuestion size={17} />
                    <div>
                      <strong>
                        {request.toolCall.title ?? 'Agent needs permission'}
                      </strong>
                      {request.toolCall.kind ? (
                        <span>{request.toolCall.kind}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="acp-session__permission-options">
                    {request.options.map((option) => (
                      <button
                        className={`acp-session__permission-option ${
                          option.kind.startsWith('allow')
                            ? 'is-allow'
                            : 'is-reject'
                        }`}
                        key={option.optionId}
                        onClick={() =>
                          onRespondPermission(requestId, option.optionId)
                        }
                        type="button"
                      >
                        {option.name}
                      </button>
                    ))}
                    <button
                      className="acp-session__permission-option is-cancel"
                      onClick={() => onRespondPermission(requestId, null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="acp-session__composer">
            <textarea
              aria-label="Message the agent"
              className="acp-session__input"
              disabled={isPrompting}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={`Ask ${agent.name} to work in this workspace…`}
              ref={textareaRef}
              rows={3}
              value={draft}
            />
            <div className="acp-session__composer-actions">
              <span className="acp-session__hint">
                Enter to send · Shift+Enter for a new line
              </span>
              {isPrompting ? (
                <button
                  className="acp-session__stop-button"
                  onClick={onStop}
                  type="button"
                >
                  <Square size={12} /> Stop
                </button>
              ) : (
                <button
                  className="acp-session__send-button"
                  disabled={!draft.trim()}
                  onClick={submit}
                  type="button"
                >
                  Send <ArrowUp size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        <ACPToolCallsPanel calls={messages} workspacePath={workspacePath} />
      </div>
    </main>
  );
}

export default ACPSessionView;
