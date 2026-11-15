import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ShieldQuestion,
  Sparkles,
  Square,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/file-city-react';
import { APP_BRANDING } from '../../../shared/config/appBranding';
import {
  IndustryMarkdownSlide,
  type AnnotationSelection,
} from 'themed-markdown';
import type {
  RequestPermissionRequest,
  ToolCallLocation,
} from '@agentclientprotocol/sdk';
import type {
  AcpAgentDefinition,
  AcpToolProcessingOutcome,
} from '../../../shared/main-process-api-interfaces/AcpAPI';
import { StreamdownMarkdown } from '../../components/StreamdownMarkdown';
import { TopicsIcon } from '../../components/TopicsIcon';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { TopicService, type Topic } from '../../main-process-api/TopicService';
import { useRepoWatch } from '../../panels/home-panel/useRepoWatch';
import { gitStatusToHighlightLayers } from '../../utils/gitStatusHighlightLayers';
import { buildCityDataFromContext } from '../file-city-panel/buildCityDataFromContext';
import { ACPWorkspaceIdentity } from './ACPWorkspaceIdentity';
import { getAcpThemeStyle } from './acpTheme';
import { getTracer } from '../../telemetry';

const acpArtifactTracer = getTracer('principal-ade-dev-workspace');

export type AcpChatMessage =
  | {
      id: string;
      role: 'user' | 'agent' | 'thought';
      text: string;
      protocolMessageId?: string;
      reference?: AcpTopicReference;
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

export interface AcpTopicReference {
  topicId: string;
  topicTitle: string;
  anchor: AnnotationSelection['anchor'];
}

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
  onSend: (text: string, reference?: AcpTopicReference) => void;
  onStop: () => void;
  onRespondPermission: (requestId: string, optionId: string | null) => void;
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

function isPrincipalMcpToolCall(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): boolean {
  const serverKey = APP_BRANDING.MCP_SERVER_CONFIG_KEY.replace(
    /[^a-z0-9]/gi,
    '',
  ).toLowerCase();
  const toolName = (call.name ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return (
    toolName.includes(serverKey) || Boolean(topicIdFromActivationInput(call))
  );
}

interface AcpTopicArtifact {
  topicId: string;
  openCount: number;
}

type ACPActivityView = 'tools' | 'artifacts';

function topicIdFromActivationInput(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  let input = '';
  try {
    input =
      typeof call.rawInput === 'string'
        ? call.rawInput
        : JSON.stringify(call.rawInput ?? '');
  } catch {
    return undefined;
  }

  const route =
    /\/api\/topics\/([^/?#"'\\\s]+)\/activate(?:[?#"'\\\s]|$)/i.exec(
      `${call.name ?? ''}\n${call.title}\n${input}`,
    );
  if (!route?.[1]) return undefined;

  try {
    return decodeURIComponent(route[1]);
  } catch {
    return route[1];
  }
}

function topicIdOpenedByCall(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  return isPrincipalMcpToolCall(call)
    ? topicIdFromActivationInput(call)
    : undefined;
}

function ACPToolCallsPanel({
  calls,
  workspacePath,
  workspaceName,
  repository,
  activityView,
  selectedTopicId,
  onOpenTopic,
}: {
  calls: AcpChatMessage[];
  workspacePath: string;
  workspaceName: string;
  repository?: ACPSessionViewProps['repository'];
  activityView: ACPActivityView;
  selectedTopicId: string | null;
  onOpenTopic: (topicId: string) => void;
}) {
  const [principalMcpOnly, setPrincipalMcpOnly] = useState(false);
  const [topicTitles, setTopicTitles] = useState<Record<string, string>>({});
  const topicTitleLookups = useRef(
    new Map<string, Promise<string | undefined>>(),
  );
  const artifactClassificationStates = useRef(new Map<string, string>());
  const toolCalls = useMemo(
    () =>
      calls.filter(
        (message): message is Extract<AcpChatMessage, { role: 'tool' }> =>
          message.role === 'tool',
      ),
    [calls],
  );
  const principalMcpCalls = useMemo(
    () => toolCalls.filter(isPrincipalMcpToolCall),
    [toolCalls],
  );
  useEffect(() => {
    for (const call of toolCalls) {
      const principalMcp = isPrincipalMcpToolCall(call);
      const topicActivationTopicId = topicIdFromActivationInput(call);
      const topicId = principalMcp ? topicActivationTopicId : undefined;
      const rawInputPresent =
        call.rawInput !== undefined && call.rawInput !== null;
      const classification = principalMcp
        ? topicId
          ? 'topic-open'
          : 'unrecognized-principal-mcp-call'
        : topicActivationTopicId
          ? 'topic-route-not-principal-mcp'
          : 'not-principal-mcp';
      const stateKey = [
        principalMcp,
        rawInputPresent,
        topicId ?? '',
        classification,
      ].join(':');
      if (
        artifactClassificationStates.current.get(call.toolCallId) === stateKey
      ) {
        continue;
      }
      artifactClassificationStates.current.set(call.toolCallId, stateKey);

      const span = acpArtifactTracer.startSpan('acp.artifact.classification');
      span.setAttribute('acp.tool.is_principal_mcp', principalMcp);
      span.setAttribute('acp.tool.raw_input_present', rawInputPresent);
      span.setAttribute(
        'acp.artifact.topic_activation_route_found',
        Boolean(topicActivationTopicId),
      );
      span.setAttribute('acp.artifact.classification', classification);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }
  }, [toolCalls]);
  const topicArtifacts = useMemo(() => {
    const artifacts = new Map<string, AcpTopicArtifact>();
    for (const call of principalMcpCalls) {
      const topicId = topicIdOpenedByCall(call);
      if (!topicId) continue;
      const existing = artifacts.get(topicId);
      artifacts.set(topicId, {
        topicId,
        openCount: (existing?.openCount ?? 0) + 1,
      });
    }
    return [...artifacts.values()];
  }, [principalMcpCalls]);
  useEffect(() => {
    if (topicArtifacts.length === 0) return undefined;
    let cancelled = false;
    const lookups = topicArtifacts.map((artifact) => {
      let lookup = topicTitleLookups.current.get(artifact.topicId);
      if (!lookup) {
        const span = acpArtifactTracer.startSpan('acp.artifact.topic_lookup');
        lookup = TopicService.getTopic(artifact.topicId)
          .then((topic) => {
            span.setAttribute('acp.artifact.topic_found', Boolean(topic));
            span.setAttribute(
              'acp.artifact.topic_title_present',
              Boolean(topic?.title),
            );
            span.setStatus({ code: SpanStatusCode.OK });
            return topic?.title;
          })
          .catch((error: unknown) => {
            span.setAttribute(
              'error.type',
              error instanceof Error ? error.name : typeof error,
            );
            span.setStatus({ code: SpanStatusCode.ERROR });
            return undefined;
          })
          .finally(() => span.end());
        topicTitleLookups.current.set(artifact.topicId, lookup);
      }
      return lookup.then((title) => ({ topicId: artifact.topicId, title }));
    });
    void Promise.all(lookups).then((results) => {
      if (cancelled) return;
      setTopicTitles((previous) => {
        const next = { ...previous };
        for (const { topicId, title } of results) {
          if (title) next[topicId] = title;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [topicArtifacts]);
  const visibleToolCalls = principalMcpOnly ? principalMcpCalls : toolCalls;
  const activeCount = visibleToolCalls.filter(
    (call) => call.status === 'in_progress' || call.status === 'pending',
  );
  const activeToolCount = activeCount.length;
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
      <div className="acp-session__tool-panel-content">
        {activityView === 'tools' ? (
          <>
            <div className="acp-session__tool-filter-row">
              <button
                className={`acp-session__tool-filter${principalMcpOnly ? ' is-active' : ''}`}
                type="button"
                aria-pressed={principalMcpOnly}
                aria-label="Filter Principal MCP calls"
                title="Show only calls made to the Principal MCP bridge"
                onClick={() => setPrincipalMcpOnly((current) => !current)}
              >
                Principal MCP
              </button>
            </div>
            <div className="acp-session__tool-activity">
              {visibleToolCalls.length === 0 ? (
                <div
                  className="acp-session__tool-panel-empty acp-session__tool-panel-empty--activity"
                  role="status"
                >
                  <span>
                    {principalMcpOnly
                      ? 'No Principal MCP bridge calls in this session.'
                      : 'Tool calls will appear here as the agent works.'}
                  </span>
                </div>
              ) : (
                <ol className="acp-session__tool-list" aria-live="polite">
                  {visibleToolCalls.map((call) => {
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
              {activeToolCount > 0 ? (
                <div className="acp-session__tool-panel-footer" role="status">
                  <Loader2 className="acp-client__spinning" size={12} />
                  {activeToolCount} active
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="acp-session__artifact-activity">
            {topicArtifacts.length === 0 ? (
              <div
                className="acp-session__tool-panel-empty acp-session__tool-panel-empty--activity"
                role="status"
              >
                <span>
                  Topics opened through Principal MCP will appear here.
                </span>
              </div>
            ) : (
              <ol className="acp-session__artifact-list">
                {topicArtifacts.map(({ topicId, openCount }) => {
                  const isSelected = selectedTopicId === topicId;
                  const title = topicTitles[topicId] ?? topicId;
                  return (
                    <li className="acp-session__artifact-card" key={topicId}>
                      <button
                        className={`acp-session__artifact-open${isSelected ? ' is-selected' : ''}`}
                        type="button"
                        onClick={() => onOpenTopic(topicId)}
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? `Close topic ${title} preview`
                            : `Open topic ${title} in chat`
                        }
                      >
                        <TopicsIcon size={16} strokeWidth={1.5} />
                        <span>
                          <strong>
                            {topicTitles[topicId] ?? `Topic ${topicId}`}
                          </strong>
                          <small>
                            Topic
                            {openCount > 1
                              ? ` · opened ${openCount} times`
                              : ''}
                          </small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
        <section
          className="acp-session__tool-city-section"
          aria-label={workspaceName}
        >
          <h3 className="acp-session__tool-city-heading">
            {repository ? (
              <span
                className="acp-client__owner-avatar acp-session__tool-city-avatar"
                aria-hidden="true"
              >
                {repository.owner.slice(0, 2).toUpperCase()}
                {repository.avatarUrl ? (
                  <img
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    src={repository.avatarUrl}
                  />
                ) : null}
              </span>
            ) : null}
            {workspaceName}
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
  const { theme } = useTheme();
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
        canvasBackgroundColor={theme.colors.background}
        defaultBuildingColor={theme.colors.backgroundSecondary}
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
}: ACPSessionViewProps) {
  const { theme } = useTheme();
  const [activityView, setActivityView] = useState<ACPActivityView>('tools');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicPreviewClosing, setTopicPreviewClosing] = useState(false);
  const [selectedTopicReference, setSelectedTopicReference] =
    useState<AcpTopicReference | null>(null);
  const [topicPreviewLoading, setTopicPreviewLoading] = useState(false);
  const [topicPreviewError, setTopicPreviewError] = useState(false);
  const [topicPreviewHeight, setTopicPreviewHeight] = useState(75);
  const [draft, setDraft] = useState('');
  const chatViewportRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const topicPreviewResizeRef = useRef<{
    startY: number;
    startHeight: number;
    viewportHeight: number;
  } | null>(null);

  const startTopicPreviewResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewportHeight =
        chatViewportRef.current?.getBoundingClientRect().height ?? 0;
      if (viewportHeight <= 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      topicPreviewResizeRef.current = {
        startY: event.clientY,
        startHeight: topicPreviewHeight,
        viewportHeight,
      };
    },
    [topicPreviewHeight],
  );

  const moveTopicPreviewResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const resize = topicPreviewResizeRef.current;
      if (!resize) return;
      const deltaPercent =
        ((event.clientY - resize.startY) / resize.viewportHeight) * 100;
      setTopicPreviewHeight(
        Math.max(20, Math.min(80, resize.startHeight + deltaPercent)),
      );
    },
    [],
  );

  const stopTopicPreviewResize = useCallback(() => {
    topicPreviewResizeRef.current = null;
  }, []);

  const handleTopicPreviewResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 5 : -5;
        setTopicPreviewHeight((height) =>
          Math.max(20, Math.min(80, height + delta)),
        );
      } else if (event.key === 'Home') {
        event.preventDefault();
        setTopicPreviewHeight(20);
      } else if (event.key === 'End') {
        event.preventDefault();
        setTopicPreviewHeight(80);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedTopicId) {
      setSelectedTopic(null);
      setTopicPreviewError(false);
      return undefined;
    }

    let cancelled = false;
    setTopicPreviewError(false);
    setTopicPreviewLoading(true);
    void TopicService.getTopic(selectedTopicId)
      .then((topic) => {
        if (cancelled) return;
        if (topic) {
          setSelectedTopic(topic);
        } else {
          setTopicPreviewError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setTopicPreviewError(true);
      })
      .finally(() => {
        if (!cancelled) setTopicPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTopicId]);

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
    const reference = selectedTopicReference ?? undefined;
    setSelectedTopicReference(null);
    onSend(text, reference);
  };
  const openTopicPreview = useCallback(
    (topicId: string) => {
      if (selectedTopicId === topicId) {
        if (topicPreviewClosing) {
          setTopicPreviewClosing(false);
          return;
        }
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          setSelectedTopicId(null);
          return;
        }
        setTopicPreviewClosing(true);
        return;
      }
      setSelectedTopicReference(null);
      setTopicPreviewClosing(false);
      setSelectedTopicId(topicId);
    },
    [selectedTopicId, topicPreviewClosing],
  );
  const finishTopicPreviewClose = useCallback(
    (event: React.AnimationEvent<HTMLElement>) => {
      if (event.animationName !== 'acp-topic-preview-exit') return;
      setTopicPreviewClosing(false);
      setSelectedTopicId(null);
    },
    [],
  );
  const handleTopicSelectionChange = useCallback(
    (selection: AnnotationSelection | null) => {
      const exact = selection?.anchor.exact.trim();
      if (!selectedTopicId || !selection || !exact) return;
      setSelectedTopicReference({
        topicId: selectedTopicId,
        topicTitle: selectedTopic?.title ?? `Topic ${selectedTopicId}`,
        anchor: selection.anchor,
      });
    },
    [selectedTopic, selectedTopicId],
  );
  const selectedTopicAnnotations = useMemo(
    () =>
      selectedTopicReference?.topicId === selectedTopicId
        ? [
            {
              id: 'acp-selected-topic-reference',
              anchor: selectedTopicReference.anchor,
            },
          ]
        : [],
    [selectedTopicId, selectedTopicReference],
  );
  const hasToolCalls = messages.some((message) => message.role === 'tool');
  const latestConversationMessage = [...messages]
    .reverse()
    .find((message) => message.role !== 'tool');
  const streamingAgentMessageId =
    isPrompting && latestConversationMessage?.role === 'agent'
      ? latestConversationMessage.id
      : undefined;
  const reverseUserMessageIndex = [...messages]
    .reverse()
    .findIndex((message) => message.role === 'user');
  const latestUserMessageIndex =
    reverseUserMessageIndex < 0
      ? -1
      : messages.length - 1 - reverseUserMessageIndex;
  const currentPromptMessages =
    latestUserMessageIndex >= 0
      ? messages.slice(latestUserMessageIndex + 1)
      : messages;
  const activeToolCall = [...currentPromptMessages]
    .reverse()
    .find(
      (message): message is Extract<AcpChatMessage, { role: 'tool' }> =>
        message.role === 'tool' &&
        (message.status === 'in_progress' || message.status === 'pending'),
    );
  const hasAgentActivity = currentPromptMessages.some(
    (message) => message.role === 'agent' || message.role === 'thought',
  );
  const activityStatus =
    permissions.length > 0
      ? 'Waiting for approval'
      : activeToolCall
        ? `Running ${activeToolCall.title}`
        : isPrompting && !hasAgentActivity
          ? 'Thinking…'
          : null;
  const workspaceName =
    repository?.name ||
    workspacePath.split(/[\\/]/).filter(Boolean).pop() ||
    workspacePath;
  const topicPreview = selectedTopicId ? (
    <section
      className={`acp-session__topic-preview${topicPreviewClosing ? ' is-closing' : ''}`}
      style={
        {
          height: `${topicPreviewHeight}%`,
          '--acp-topic-preview-height': `${topicPreviewHeight}%`,
        } as React.CSSProperties
      }
      role="region"
      aria-label={`Topic preview: ${selectedTopic?.title ?? `Topic ${selectedTopicId}`}`}
      onAnimationEnd={finishTopicPreviewClose}
    >
      <div className="acp-session__topic-preview-content">
        {topicPreviewLoading && !selectedTopic ? (
          <div className="acp-session__topic-preview-message" role="status">
            <Loader2 className="acp-client__spinning" size={15} />
            Loading topic…
          </div>
        ) : topicPreviewError || !selectedTopic ? (
          <div className="acp-session__topic-preview-message" role="alert">
            Couldn’t load this topic.
          </div>
        ) : selectedTopic.description ? (
          <div className="acp-session__topic-preview-markdown">
            <IndustryMarkdownSlide
              key={selectedTopic.id}
              content={selectedTopic.description}
              slideIdPrefix={`acp-session-topic-${selectedTopic.id}`}
              slideIndex={0}
              isVisible
              theme={theme}
              fontSizeScale={theme.fontScale ?? 1}
              transparentBackground
              disableBasePadding={{ horizontal: true }}
              enableKeyboardScrolling={false}
              annotations={selectedTopicAnnotations}
              activeAnnotationId={
                selectedTopicAnnotations.length > 0
                  ? 'acp-selected-topic-reference'
                  : null
              }
              onSelectionChange={handleTopicSelectionChange}
            />
          </div>
        ) : (
          <div className="acp-session__topic-preview-message">
            This topic has no description.
          </div>
        )}
      </div>
      <div
        className="acp-session__topic-preview-resize"
        role="separator"
        aria-label="Resize topic preview"
        aria-orientation="horizontal"
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={Math.round(topicPreviewHeight)}
        tabIndex={0}
        onKeyDown={handleTopicPreviewResizeKeyDown}
        onPointerDown={startTopicPreviewResize}
        onPointerMove={moveTopicPreviewResize}
        onPointerUp={stopTopicPreviewResize}
        onPointerCancel={stopTopicPreviewResize}
        onLostPointerCapture={stopTopicPreviewResize}
      >
        <span />
      </div>
    </section>
  ) : null;

  return (
    <main
      className="acp-session"
      aria-label="ACP agent session"
      style={getAcpThemeStyle(theme)}
    >
      <header className="acp-session__topbar">
        <ACPWorkspaceIdentity
          workspacePath={workspacePath}
          repository={repository}
        />
        <div
          className="acp-session__activity-switch"
          role="tablist"
          aria-label="Activity view"
        >
          <button
            className={activityView === 'tools' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activityView === 'tools'}
            onClick={() => setActivityView('tools')}
          >
            Tools
          </button>
          <button
            className={activityView === 'artifacts' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activityView === 'artifacts'}
            onClick={() => setActivityView('artifacts')}
          >
            Artifacts
          </button>
        </div>
      </header>

      <div className="acp-session__workspace">
        <div className="acp-session__main">
          <div className="acp-session__chat-viewport" ref={chatViewportRef}>
            {topicPreview}
            <div
              className="acp-session__messages"
              role="log"
              aria-live={selectedTopicId ? 'off' : 'polite'}
            >
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
                          {message.reference ? (
                            <div className="acp-session__message-reference">
                              <TopicsIcon size={13} strokeWidth={1.5} />
                              <span>
                                Reference · {message.reference.topicTitle}
                              </span>
                              <blockquote>
                                {message.reference.anchor.exact}
                              </blockquote>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  case 'agent':
                    return (
                      <div className="acp-session__row" key={message.id}>
                        <div className="acp-session__bubble">
                          <span className="acp-session__role">
                            {agent.name}
                          </span>
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

              {activityStatus ? (
                <div
                  className="acp-session__activity-status"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2
                    className="acp-client__spinning"
                    size={13}
                    aria-hidden="true"
                  />
                  <span>{activityStatus}</span>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>
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
            {selectedTopicReference ? (
              <div className="acp-session__reference-chip">
                <TopicsIcon size={15} strokeWidth={1.5} />
                <span>
                  <strong>
                    Reference · {selectedTopicReference.topicTitle}
                  </strong>
                  <small>{selectedTopicReference.anchor.exact}</small>
                </span>
                <button
                  type="button"
                  aria-label="Remove topic reference"
                  onClick={() => setSelectedTopicReference(null)}
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
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
        <ACPToolCallsPanel
          calls={messages}
          workspacePath={workspacePath}
          workspaceName={workspaceName}
          repository={repository}
          activityView={activityView}
          selectedTopicId={selectedTopicId}
          onOpenTopic={openTopicPreview}
        />
      </div>
    </main>
  );
}

export default ACPSessionView;
