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
  Cpu,
  Loader2,
  Network,
  PenTool,
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
import { useFileTree } from '@pierre/trees/react';
import type { GitStatusEntry } from '@pierre/trees';
import type {
  FileTree as RepoFileTree,
  GitStatusWithFiles,
} from '@principal-ai/repository-abstraction';
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
  SubsystemTrail,
  SubsystemTrailStep,
} from '@principal-ai/subsystems-core';
import type {
  AcpAgentDefinition,
  AcpFileOperation,
  AcpHighlightItem,
  AcpModelSelection,
  AcpToolProcessingOutcome,
} from '../../../shared/main-process-api-interfaces/AcpAPI';
import { parsePatchFiles } from '@pierre/diffs';
import { FileDiff, type FileDiffMetadata } from '@pierre/diffs/react';
import { StreamdownMarkdown } from '../../components/StreamdownMarkdown';
import { ThemedFileTree } from '../../components/shared/ThemedFileTree';
import { TopicsIcon } from '../../components/TopicsIcon';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';
import { GitService } from '../../main-process-api/GitService';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';
import { getDrawingSummary } from '../../drawings-view/drawingsStorage';
import { TopicService, type Topic } from '../../main-process-api/TopicService';
import { useRepoWatch } from '../../panels/home-panel/useRepoWatch';
import { PierreFileView } from '../../panels/PierreFileView';
import { gitStatusToHighlightLayers } from '../../utils/gitStatusHighlightLayers';
import { buildCityDataFromContext } from '../file-city-panel/buildCityDataFromContext';
import { SubsystemModelTabContent } from '../../subsystem-models/SubsystemModelTabContent';
import {
  ACPDrawingPreview,
  type DrawingElementSelection,
  type DrawingSelectedElement,
} from './ACPDrawingPreview';
import { ACPModelPicker } from './ACPModelPicker';
import type { SubsystemTrailSelection } from '../../subsystem-models/SubsystemModelGraph';
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
      reference?: AcpChatReference;
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
      highlightItems?: AcpHighlightItem[];
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

/**
 * A trail (or one of its steps) the user focused in a subsystem model preview,
 * attached as quoted context for the next prompt. Mirrors AcpTopicReference.
 */
export interface AcpModelReference {
  modelId: string;
  modelTitle: string;
  trailId: string;
  trailTitle: string;
  /** Focused step index; undefined means the whole trail. */
  stepIndex?: number;
  stepSummary: string;
}

/**
 * Drawing pieces the user clicked in a drawing preview, attached as quoted
 * context for the next prompt. Mirrors AcpTopicReference.
 */
export interface AcpDrawingReference {
  drawingId: string;
  drawingName: string;
  elementIds: string[];
  elementSummary: string;
}

export type AcpChatReference =
  AcpTopicReference | AcpModelReference | AcpDrawingReference;

export function isAcpTopicReference(
  reference: AcpChatReference,
): reference is AcpTopicReference {
  return 'anchor' in reference;
}

export function isAcpModelReference(
  reference: AcpChatReference,
): reference is AcpModelReference {
  return 'trailId' in reference;
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
  sessionTitle?: string | null;
  messages: AcpChatMessage[];
  permissions: AcpPendingPermission[];
  isPrompting: boolean;
  /** Model picker state from `session/new`, shown before the first message. */
  modelSelection?: AcpModelSelection;
  modelError?: string;
  onModelChange?: (model: string) => void;
  onSend: (text: string, reference?: AcpChatReference) => void;
  onStop: () => void;
  onRespondPermission: (requestId: string, optionId: string | null) => void;
}

interface OperationLayerStyle {
  label: string;
  color: string;
  priority: number;
  opacity: number;
  renderStrategy: 'fill' | 'border';
  maxItems: number;
}

/**
 * Activity is bucketed by operation so writes/deletes stay legible even when
 * the session is dominated by reads. Priorities also decide which operation
 * wins when the same file appears in several calls.
 */
const OPERATION_LAYER_STYLES: Record<AcpFileOperation, OperationLayerStyle> = {
  delete: {
    label: 'Deletes',
    color: '#ef4444',
    priority: 96,
    opacity: 0.9,
    renderStrategy: 'fill',
    maxItems: 50,
  },
  write: {
    label: 'Writes',
    color: '#22c55e',
    priority: 92,
    opacity: 0.85,
    renderStrategy: 'fill',
    maxItems: 50,
  },
  create: {
    label: 'New files',
    color: '#10b981',
    priority: 90,
    opacity: 0.85,
    renderStrategy: 'fill',
    maxItems: 50,
  },
  edit: {
    label: 'Edits',
    color: '#f59e0b',
    priority: 88,
    opacity: 0.85,
    renderStrategy: 'fill',
    maxItems: 60,
  },
  move: {
    label: 'Moves',
    color: '#f97316',
    priority: 86,
    opacity: 0.8,
    renderStrategy: 'fill',
    maxItems: 40,
  },
  search: {
    label: 'Searches',
    color: '#8b5cf6',
    priority: 60,
    opacity: 0.5,
    renderStrategy: 'border',
    maxItems: 40,
  },
  list: {
    label: 'Listings',
    color: '#6366f1',
    priority: 50,
    opacity: 0.4,
    renderStrategy: 'border',
    maxItems: 20,
  },
  read: {
    label: 'Reads',
    color: '#3b82f6',
    priority: 40,
    opacity: 0.38,
    renderStrategy: 'border',
    maxItems: 30,
  },
  execute: {
    label: 'Commands',
    color: '#6b7280',
    priority: 30,
    opacity: 0.45,
    renderStrategy: 'border',
    maxItems: 25,
  },
};

const OPERATION_ORDER: AcpFileOperation[] = [
  'delete',
  'write',
  'create',
  'edit',
  'move',
  'search',
  'list',
  'read',
  'execute',
];

function operationFromTool(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): AcpFileOperation {
  const kind = call.kind?.toLowerCase();
  if (kind === 'read') return 'read';
  if (kind === 'delete') return 'delete';
  if (kind === 'move') return 'move';
  if (kind === 'search') return 'search';
  if (kind === 'edit') {
    const name = call.name?.toLowerCase();
    if (name === 'write') return 'write';
    if (name === 'patch') return 'edit';
    return 'edit';
  }
  return 'execute';
}

function callHighlightItems(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): AcpHighlightItem[] {
  if (call.highlightItems && call.highlightItems.length > 0) {
    return call.highlightItems;
  }
  const operation = operationFromTool(call);
  return [...new Set(call.highlightPaths ?? [])].map((path) => ({
    path,
    operation,
  }));
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
    toolName.includes(serverKey) ||
    Boolean(topicIdFromActivationInput(call)) ||
    Boolean(subsystemModelIdFromReadInput(call)) ||
    Boolean(drawingIdFromFileInput(call)) ||
    Boolean(artifactAssociationFromInput(call))
  );
}

type AcpArtifactKind = 'topic' | 'subsystem-model' | 'drawing';

interface AcpArtifact {
  kind: AcpArtifactKind;
  id: string;
  openCount: number;
}

/** A selected artifact identity, used to drive the preview pane. */
interface AcpArtifactRef {
  kind: AcpArtifactKind;
  id: string;
  title: string;
}

type ACPActivityView = 'tools' | 'artifacts';

function artifactKey(kind: AcpArtifactKind, id: string): string {
  return `${kind}:${id}`;
}

function toolCallInputText(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  try {
    return typeof call.rawInput === 'string'
      ? call.rawInput
      : JSON.stringify(call.rawInput ?? '');
  } catch {
    return undefined;
  }
}

function decodeRouteId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function topicIdFromActivationInput(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  const input = toolCallInputText(call);
  if (input === undefined) return undefined;

  const route =
    /\/api\/topics\/([^/?#"'\\\s]+)\/activate(?:[?#"'\\\s]|$)/i.exec(
      `${call.name ?? ''}\n${call.title}\n${input}`,
    );
  if (!route?.[1]) return undefined;

  return decodeRouteId(route[1]);
}

function subsystemModelIdFromReadInput(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  const input = toolCallInputText(call);
  if (input === undefined) return undefined;

  const route =
    /\/api\/subsystem-models\/([^/?#"'\\\s]+)(?:[?#"'\\\s]|$)/i.exec(
      `${call.name ?? ''}\n${call.title}\n${input}`,
    );
  if (!route?.[1]) return undefined;

  return decodeRouteId(route[1]);
}

interface AcpArtifactAssociationInput {
  kind: AcpArtifactKind;
  id: string;
  title?: string;
}

/**
 * An explicit artifact↔session association is itself a Principal MCP bridge
 * call (`POST /api/acp/sessions/:sessionId/artifacts`), usually issued via a
 * shell `curl`. `session/load` replays tool calls including their inputs, so
 * the Artifacts list can be derived from the conversation with no app-side
 * store: matching the route here keeps the list durable across restarts.
 */
function artifactAssociationFromInput(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): AcpArtifactAssociationInput | undefined {
  const input = toolCallInputText(call);
  if (input === undefined) return undefined;

  const haystack = `${call.name ?? ''}\n${call.title}\n${input}`;
  const route =
    /\/api\/acp\/sessions\/[^/?#"'\\\s]+\/artifacts(?:[?#"'\\\s]|$)/i.exec(
      haystack,
    );
  if (!route) return undefined;

  // Tool inputs arrive JSON-stringified, so a shell `curl -d '{"kind":…}'`
  // body shows up with escaped quotes. Normalize before extracting fields.
  const normalized = haystack.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const kindMatch = /"kind"\s*:\s*"(topic|subsystem-model|drawing)"/i.exec(
    normalized,
  );
  const idMatch = /(?:^|[^A-Za-z0-9_])"id"\s*:\s*"([^"]+)"/.exec(normalized);
  if (!kindMatch?.[1] || !idMatch?.[1]) return undefined;
  const kind = kindMatch[1].toLowerCase() as AcpArtifactKind;
  const id = idMatch[1].trim();
  if (!id) return undefined;
  const titleMatch = /(?:^|[^A-Za-z0-9_])"title"\s*:\s*"([^"]*)"/.exec(
    normalized,
  );
  const title = titleMatch?.[1]?.trim();
  return { kind, id, ...(title ? { title } : {}) };
}

/**
 * A drawing the agent read from disk. Drawings are local files rather than
 * bridge resources, so the agent reaches them with shell reads like
 * `cat ~/.alexandria/drawings/<id>.excalidraw` (see `drawingContextDragText`).
 */
function drawingIdFromFileInput(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  const input = toolCallInputText(call);
  if (input === undefined) return undefined;

  const route = /drawings\/([^/?#"'\\\s]+?)\.excalidraw(?:[?#"'\\\s]|$)/i.exec(
    `${call.name ?? ''}\n${call.title}\n${input}`,
  );
  if (!route?.[1]) return undefined;

  return decodeRouteId(route[1]);
}

function topicIdOpenedByCall(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  return isPrincipalMcpToolCall(call)
    ? topicIdFromActivationInput(call)
    : undefined;
}

function subsystemModelIdReadByCall(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  return isPrincipalMcpToolCall(call)
    ? subsystemModelIdFromReadInput(call)
    : undefined;
}

function drawingIdReadByCall(
  call: Extract<AcpChatMessage, { role: 'tool' }>,
): string | undefined {
  return isPrincipalMcpToolCall(call)
    ? drawingIdFromFileInput(call)
    : undefined;
}

function artifactsFromCalls(
  calls: Extract<AcpChatMessage, { role: 'tool' }>[],
): AcpArtifact[] {
  const artifacts = new Map<string, AcpArtifact>();
  const record = (kind: AcpArtifactKind, id: string) => {
    const key = artifactKey(kind, id);
    const existing = artifacts.get(key);
    artifacts.set(key, { kind, id, openCount: (existing?.openCount ?? 0) + 1 });
  };
  for (const call of calls) {
    const topicId = topicIdOpenedByCall(call);
    if (topicId) record('topic', topicId);
    const modelId = subsystemModelIdReadByCall(call);
    if (modelId) record('subsystem-model', modelId);
    const drawingId = drawingIdReadByCall(call);
    if (drawingId) record('drawing', drawingId);
    const association = artifactAssociationFromInput(call);
    if (association) record(association.kind, association.id);
  }
  return [...artifacts.values()];
}

/** Agent-provided association titles, used as a fallback until looked up. */
function associationTitlesFromCalls(
  calls: Extract<AcpChatMessage, { role: 'tool' }>[],
): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const call of calls) {
    const association = artifactAssociationFromInput(call);
    if (association?.title) {
      titles[artifactKey(association.kind, association.id)] = association.title;
    }
  }
  return titles;
}

function artifactKindLabel(kind: AcpArtifactKind): string {
  switch (kind) {
    case 'topic':
      return 'Topic';
    case 'subsystem-model':
      return 'Subsystem model';
    case 'drawing':
      return 'Drawing';
  }
}

function artifactFallbackTitle(kind: AcpArtifactKind, id: string): string {
  return `${artifactKindLabel(kind)} ${id}`;
}

/** One-line location for a trail step: file + optional line range. */
function modelStepSite(step: SubsystemTrailStep): string {
  const span = step.span ? `:${step.span.startLine}-${step.span.endLine}` : '';
  return `${step.file}${span}`;
}

/** Quoted summary for a single focused trail step. */
function describeModelStep(
  trail: SubsystemTrail,
  step: SubsystemTrailStep,
  stepIndex: number,
): string {
  const lines = [
    `Step ${stepIndex + 1} of ${trail.steps.length}: ${step.from} → ${step.to} (${step.mechanism})`,
    `Site: ${modelStepSite(step)} — ${step.symbol}`,
  ];
  if (step.annotation) lines.push(`Note: ${step.annotation}`);
  return lines.join('\n');
}

const MAX_TRAIL_SUMMARY_STEPS = 10;

const MAX_DRAWING_SUMMARY_ELEMENTS = 10;

/** Quoted summary for drawing pieces the user clicked. */
function describeDrawingElements(elements: DrawingSelectedElement[]): string {
  const lines = elements
    .slice(0, MAX_DRAWING_SUMMARY_ELEMENTS)
    .map(
      (element, index) =>
        `Element ${index + 1}: ${element.type}${element.text ? ` "${element.text}"` : ''} (id: ${element.id})`,
    );
  if (elements.length > MAX_DRAWING_SUMMARY_ELEMENTS) {
    lines.push(
      `…and ${elements.length - MAX_DRAWING_SUMMARY_ELEMENTS} more elements`,
    );
  }
  return lines.join('\n');
}

/** Quoted summary for a whole focused trail, capped so prompts stay small. */
function describeModelTrail(trail: SubsystemTrail): string {
  const lines = [`Trail "${trail.title}" (${trail.steps.length} steps):`];
  for (const [index, step] of trail.steps
    .slice(0, MAX_TRAIL_SUMMARY_STEPS)
    .entries()) {
    lines.push(
      `${index + 1}. ${step.from} → ${step.to} (${step.mechanism}) @ ${modelStepSite(step)}`,
    );
  }
  if (trail.steps.length > MAX_TRAIL_SUMMARY_STEPS) {
    lines.push(
      `…and ${trail.steps.length - MAX_TRAIL_SUMMARY_STEPS} more steps`,
    );
  }
  return lines.join('\n');
}

function artifactTitle(
  kind: AcpArtifactKind,
  id: string,
  titles: Record<string, string>,
): string {
  return titles[artifactKey(kind, id)] ?? artifactFallbackTitle(kind, id);
}

function ACPToolCallsPanel({
  calls,
  workspacePath,
  workspaceName,
  repository,
  activityView,
  selectedArtifact,
  onOpenArtifact,
  onOpenFilePreview,
  onCloseFilePreview,
}: {
  calls: AcpChatMessage[];
  workspacePath: string;
  workspaceName: string;
  repository?: ACPSessionViewProps['repository'];
  activityView: ACPActivityView;
  selectedArtifact: AcpArtifactRef | null;
  onOpenArtifact: (artifact: AcpArtifactRef) => void;
  onOpenFilePreview: (relPath: string) => void;
  onCloseFilePreview: () => void;
}) {
  const { theme } = useTheme();
  const [principalMcpOnly, setPrincipalMcpOnly] = useState(false);
  const [cityView, setCityView] = useState<'map' | 'tree'>('map');
  const [artifactTitles, setArtifactTitles] = useState<Record<string, string>>(
    {},
  );
  const artifactTitleLookups = useRef(
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
      const subsystemModelId = subsystemModelIdFromReadInput(call);
      const drawingId = drawingIdFromFileInput(call);
      const association = artifactAssociationFromInput(call);
      const rawInputPresent =
        call.rawInput !== undefined && call.rawInput !== null;
      const classification = principalMcp
        ? topicActivationTopicId
          ? 'topic-open'
          : subsystemModelId
            ? 'subsystem-model-read'
            : drawingId
              ? 'drawing-file'
              : association
                ? 'artifact-association'
                : 'unrecognized-principal-mcp-call'
        : topicActivationTopicId || subsystemModelId || drawingId || association
          ? 'bridge-route-not-principal-mcp'
          : 'not-principal-mcp';
      const stateKey = [
        principalMcp,
        rawInputPresent,
        topicActivationTopicId ?? '',
        subsystemModelId ?? '',
        drawingId ?? '',
        association ? `${association.kind}:${association.id}` : '',
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
      span.setAttribute(
        'acp.artifact.subsystem_model_read_route_found',
        Boolean(subsystemModelId),
      );
      span.setAttribute(
        'acp.artifact.drawing_file_route_found',
        Boolean(drawingId),
      );
      span.setAttribute(
        'acp.artifact.association_route_found',
        Boolean(association),
      );
      if (association) {
        span.setAttribute('acp.artifact.kind', association.kind);
      }
      span.setAttribute('acp.artifact.classification', classification);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }
  }, [toolCalls]);
  // Explicit associations carry an agent-provided title, used as a fallback
  // until the artifact id is looked up.
  const associatedTitles = useMemo(
    () => associationTitlesFromCalls(toolCalls),
    [toolCalls],
  );
  const artifacts = useMemo(
    () => artifactsFromCalls(principalMcpCalls),
    [principalMcpCalls],
  );
  useEffect(() => {
    if (artifacts.length === 0) return undefined;
    let cancelled = false;
    const lookups = artifacts.map((artifact) => {
      const key = artifactKey(artifact.kind, artifact.id);
      let lookup = artifactTitleLookups.current.get(key);
      if (!lookup) {
        const span = acpArtifactTracer.startSpan('acp.artifact.title_lookup');
        span.setAttribute('acp.artifact.kind', artifact.kind);
        lookup =
          artifact.kind === 'topic'
            ? TopicService.getTopic(artifact.id).then((topic) => {
                span.setAttribute('acp.artifact.found', Boolean(topic));
                span.setAttribute(
                  'acp.artifact.title_present',
                  Boolean(topic?.title),
                );
                span.setStatus({ code: SpanStatusCode.OK });
                return topic?.title;
              })
            : artifact.kind === 'drawing'
              ? getDrawingSummary(artifact.id).then((drawing) => {
                  span.setAttribute('acp.artifact.found', Boolean(drawing));
                  span.setAttribute(
                    'acp.artifact.title_present',
                    Boolean(drawing?.name),
                  );
                  span.setStatus({ code: SpanStatusCode.OK });
                  return drawing?.name;
                })
              : SubsystemModelService.get(artifact.id).then((model) => {
                  span.setAttribute('acp.artifact.found', Boolean(model));
                  span.setAttribute(
                    'acp.artifact.title_present',
                    Boolean(model?.title),
                  );
                  span.setStatus({ code: SpanStatusCode.OK });
                  return model?.title;
                });
        lookup = lookup
          .catch((error: unknown) => {
            span.setAttribute(
              'error.type',
              error instanceof Error ? error.name : typeof error,
            );
            span.setStatus({ code: SpanStatusCode.ERROR });
            return undefined;
          })
          .finally(() => span.end());
        artifactTitleLookups.current.set(key, lookup);
      }
      return lookup.then((title) => ({ key, title }));
    });
    void Promise.all(lookups).then((results) => {
      if (cancelled) return;
      setArtifactTitles((previous) => {
        const next = { ...previous };
        for (const { key, title } of results) {
          if (title) next[key] = title;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [artifacts]);
  const visibleToolCalls = principalMcpOnly ? principalMcpCalls : toolCalls;
  const activeCount = visibleToolCalls.filter(
    (call) => call.status === 'in_progress' || call.status === 'pending',
  );
  const activeToolCount = activeCount.length;
  const highlightLayers = useMemo<HighlightLayer[]>(() => {
    // Newest first so recency wins ties and each bucket caps to its newest
    // items. Paths are lifted to the strongest operation that touched them.
    const recentCalls = toolCalls.slice(-60).reverse();
    const activePaths = new Set<string>();
    const byOperation = new Map<
      AcpFileOperation,
      Map<string, AcpHighlightItem>
    >();

    for (const call of recentCalls) {
      const isActive =
        call.status === 'pending' || call.status === 'in_progress';
      for (const item of callHighlightItems(call)) {
        const operation = item.operation;
        const operationPriority = OPERATION_LAYER_STYLES[operation].priority;
        let superseded = false;
        for (const [otherOperation, bucket] of byOperation) {
          if (
            otherOperation !== operation &&
            bucket.has(item.path) &&
            OPERATION_LAYER_STYLES[otherOperation].priority > operationPriority
          ) {
            superseded = true;
            break;
          }
        }
        if (superseded) continue;

        for (const [otherOperation, bucket] of byOperation) {
          if (
            otherOperation !== operation &&
            OPERATION_LAYER_STYLES[otherOperation].priority < operationPriority
          ) {
            bucket.delete(item.path);
          }
        }

        const bucket = byOperation.get(operation) ?? new Map();
        if (!bucket.has(item.path)) {
          bucket.set(item.path, item);
        }
        byOperation.set(operation, bucket);
        if (isActive) activePaths.add(item.path);
      }
    }

    const layers: HighlightLayer[] = [];
    for (const operation of OPERATION_ORDER) {
      const bucket = byOperation.get(operation);
      if (!bucket || bucket.size === 0) continue;
      const style = OPERATION_LAYER_STYLES[operation];
      layers.push({
        id: `acp-operation-${operation}`,
        name: style.label,
        enabled: true,
        color: style.color,
        opacity: style.opacity,
        priority: style.priority,
        dynamic: true,
        items: [...bucket.values()].slice(0, style.maxItems).map((item) => ({
          path: item.path,
          type: item.kind === 'directory' ? 'directory' : 'file',
          renderStrategy: activePaths.has(item.path)
            ? ('border' as const)
            : style.renderStrategy,
        })),
      });
    }

    if (activePaths.size > 0) {
      const activeItems = [...activePaths].flatMap((path) => {
        for (const bucket of byOperation.values()) {
          const item = bucket.get(path);
          if (item) {
            return [
              {
                path,
                type:
                  item.kind === 'directory'
                    ? ('directory' as const)
                    : ('file' as const),
                renderStrategy: 'border' as const,
              },
            ];
          }
        }
        return [];
      });
      if (activeItems.length > 0) {
        layers.push({
          id: 'acp-active-tool',
          name: 'Active tool',
          enabled: true,
          color: theme.colors.primary,
          opacity: 1,
          borderWidth: 3,
          priority: 120,
          dynamic: true,
          items: activeItems.slice(0, 40),
        });
      }
    }

    return layers;
  }, [theme.colors.primary, toolCalls]);
  const { gitStatusWithFiles } = useRepositoryGitStatus(workspacePath);
  const gitHighlightLayers = useMemo(
    () =>
      gitStatusWithFiles
        ? gitStatusToHighlightLayers(gitStatusWithFiles, 'acp-git-status')
        : [],
    [gitStatusWithFiles],
  );
  const hasHighlightLayers = [...gitHighlightLayers, ...highlightLayers].some(
    (layer) => (layer.items?.length ?? 0) > 0,
  );
  useEffect(() => {
    if (!hasHighlightLayers) setCityView('map');
  }, [hasHighlightLayers]);
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
            {artifacts.length === 0 ? (
              <div
                className="acp-session__tool-panel-empty acp-session__tool-panel-empty--activity"
                role="status"
              >
                <span>
                  Topics, subsystem models, and drawings the agent works with
                  through Principal MCP will appear here.
                </span>
              </div>
            ) : (
              <ol className="acp-session__artifact-list">
                {artifacts.map(({ kind, id, openCount }) => {
                  const isSelected =
                    selectedArtifact?.kind === kind &&
                    selectedArtifact.id === id;
                  const title = artifactTitle(kind, id, {
                    ...associatedTitles,
                    ...artifactTitles,
                  });
                  return (
                    <li
                      className="acp-session__artifact-card"
                      key={artifactKey(kind, id)}
                    >
                      <button
                        className={`acp-session__artifact-open${isSelected ? ' is-selected' : ''}`}
                        type="button"
                        onClick={() => onOpenArtifact({ kind, id, title })}
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? `Close ${artifactKindLabel(kind)} ${title} preview`
                            : `Open ${artifactKindLabel(kind)} ${title} in chat`
                        }
                      >
                        {kind === 'topic' ? (
                          <TopicsIcon size={16} strokeWidth={1.5} />
                        ) : kind === 'drawing' ? (
                          <PenTool size={16} strokeWidth={1.5} />
                        ) : (
                          <Network size={16} strokeWidth={1.5} />
                        )}
                        <span>
                          <strong>{title}</strong>
                          <small>
                            {artifactKindLabel(kind)}
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
          <div className="acp-session__tool-city-header">
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
            {hasHighlightLayers ? (
              <span
                className="acp-session__city-view-toggle"
                role="tablist"
                aria-label="File map view"
              >
                <button
                  className={`acp-session__city-view-toggle-button${cityView === 'map' ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={cityView === 'map'}
                  onClick={() => setCityView('map')}
                >
                  Map
                </button>
                <button
                  className={`acp-session__city-view-toggle-button${cityView === 'tree' ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={cityView === 'tree'}
                  onClick={() => setCityView('tree')}
                >
                  Tree
                </button>
              </span>
            ) : null}
          </div>
          {cityView === 'tree' && hasHighlightLayers ? (
            <ACPHighlightTreeView
              workspacePath={workspacePath}
              highlightLayers={highlightLayers}
              gitStatusWithFiles={gitStatusWithFiles}
              onOpenFilePreview={onOpenFilePreview}
              onCloseFilePreview={onCloseFilePreview}
            />
          ) : (
            <ACPFileCityView
              workspacePath={workspacePath}
              highlightLayers={highlightLayers}
              gitHighlightLayers={gitHighlightLayers}
            />
          )}
        </section>
      </div>
    </aside>
  );
}

function ACPFileCityView({
  workspacePath,
  highlightLayers,
  gitHighlightLayers,
}: {
  workspacePath: string;
  highlightLayers: HighlightLayer[];
  gitHighlightLayers: HighlightLayer[];
}) {
  const { theme } = useTheme();
  useRepoWatch(workspacePath);
  const { gitStatusWithFiles } = useRepositoryGitStatus(workspacePath);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

function normalizeWorkspacePath(path: string): string {
  return path.trim().replace(/^\.\//, '').replace(/\/+$/, '');
}

// Adapter: collapse the categorical buckets in `GitStatusWithFiles`
// (repo-relative paths) into Pierre's flat `GitStatusEntry[]`, keyed by the
// same tree-node `path` strings the FileTree renders. Mirrors the adapter in
// the dev-workspace FilesPanel.
function buildACPHighlightGitStatusEntries(
  tree: RepoFileTree | null,
  status: GitStatusWithFiles | null | undefined,
): GitStatusEntry[] {
  if (!tree || !status) return [];
  // relativePath -> tree-node path, so git's relative buckets can be mapped
  // onto the exact strings the tree keys on.
  const relToPath = new Map<string, string>();
  for (const f of tree.allFiles) relToPath.set(f.relativePath, f.path);

  const map = new Map<string, GitStatusEntry['status']>();
  const set = (rel: string, s: GitStatusEntry['status']) => {
    const path = relToPath.get(rel);
    if (path) map.set(path, s);
  };
  for (const p of status.untrackedFiles ?? []) set(p, 'untracked');
  for (const p of status.createdFiles ?? []) set(p, 'added');
  for (const p of status.stagedFiles ?? []) set(p, 'modified');
  for (const p of status.modifiedFiles ?? []) set(p, 'modified');
  for (const p of status.deletedFiles ?? []) set(p, 'deleted');
  const entries: GitStatusEntry[] = [];
  for (const [path, s] of map) entries.push({ path, status: s });
  return entries;
}

function ACPHighlightTreeView({
  workspacePath,
  highlightLayers,
  gitStatusWithFiles,
  onOpenFilePreview,
  onCloseFilePreview,
}: {
  workspacePath: string;
  highlightLayers: HighlightLayer[];
  gitStatusWithFiles: GitStatusWithFiles | null;
  onOpenFilePreview: (relPath: string) => void;
  onCloseFilePreview: () => void;
}) {
  const [fileTree, setFileTree] = useState<RepoFileTree | null>(null);
  const [isResolvingTree, setIsResolvingTree] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setFileTree(null);
    setIsResolvingTree(true);
    void (async () => {
      try {
        const next =
          await RepositoryMonitoringService.getFileTree(workspacePath);
        if (!cancelled) setFileTree(next);
      } catch {
        if (!cancelled) setFileTree(null);
      } finally {
        if (!cancelled) setIsResolvingTree(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  // Repo-relative paths the session highlighted: agent operation layers plus
  // git working-tree buckets. Deleted files are excluded — they no longer
  // exist in the tree. Anything here that matches no tree entry (e.g.
  // non-path strings pulled from tool output) is dropped when resolving
  // below, just like the map only renders buildings the file tree has.
  const highlightedRelative = useMemo(() => {
    const highlighted = new Set<string>();
    for (const layer of highlightLayers) {
      for (const item of layer.items ?? []) {
        const rel = normalizeWorkspacePath(item.path);
        if (rel) highlighted.add(rel);
      }
    }
    if (gitStatusWithFiles) {
      const buckets = [
        gitStatusWithFiles.modifiedFiles,
        gitStatusWithFiles.stagedFiles,
        gitStatusWithFiles.createdFiles,
        gitStatusWithFiles.untrackedFiles,
      ];
      for (const bucket of buckets) {
        for (const rawPath of bucket ?? []) {
          const rel = normalizeWorkspacePath(rawPath);
          if (rel) highlighted.add(rel);
        }
      }
    }
    return highlighted;
  }, [highlightLayers, gitStatusWithFiles]);

  // Tree-node `path` strings for highlighted files, resolved by joining
  // repo-relative highlight paths to tree nodes via relativePath (the
  // FilesPanel idiom — works regardless of absolute or relative tree
  // paths). Highlighted directories expand to the files under them.
  // @pierre/trees' Builder rejects duplicate paths, so dedupe here.
  const { highlightedTreePaths, treePathToRel } = useMemo(() => {
    if (!fileTree)
      return {
        highlightedTreePaths: [],
        treePathToRel: new Map<string, string>(),
      };
    const relToPath = new Map<string, string>();
    for (const file of fileTree.allFiles) {
      relToPath.set(normalizeWorkspacePath(file.relativePath), file.path);
    }
    const paths = new Set<string>();
    const toRel = new Map<string, string>();
    const add = (treePath: string, rel: string) => {
      paths.add(treePath);
      if (!toRel.has(treePath)) toRel.set(treePath, rel);
    };
    for (const rel of highlightedRelative) {
      const direct = relToPath.get(rel);
      if (direct) {
        add(direct, rel);
        continue;
      }
      const prefix = `${rel}/`;
      for (const [fileRel, treePath] of relToPath) {
        if (fileRel.startsWith(prefix)) add(treePath, fileRel);
      }
    }
    return { highlightedTreePaths: [...paths].sort(), treePathToRel: toRel };
  }, [fileTree, highlightedRelative]);

  // useFileTree() captures onSelectionChange once, so the tree-path →
  // repo-relative mapping it resolves through lives in a ref.
  const treePathToRelRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    treePathToRelRef.current = treePathToRel;
  }, [treePathToRel]);

  const gitStatusEntries = useMemo(
    () => buildACPHighlightGitStatusEntries(fileTree, gitStatusWithFiles),
    [fileTree, gitStatusWithFiles],
  );

  // Ancestor directories (tree-node ids) of every highlighted file, used to
  // auto-open folders so the narrowed set is visible rather than buried
  // under collapsed parents.
  const ancestorDirPaths = useMemo(() => {
    const dirs = new Set<string>();
    for (const treePath of highlightedTreePaths) {
      const segments = treePath.split('/');
      for (let index = 1; index < segments.length; index += 1) {
        const dir = segments.slice(0, index).join('/');
        if (dir) dirs.add(dir);
      }
    }
    return [...dirs];
  }, [highlightedTreePaths]);

  const { model } = useFileTree({
    paths: highlightedTreePaths,
    search: true,
    initialExpandedPaths: [],
    gitStatus: gitStatusEntries,
    onSelectionChange: (selected) => {
      // The model is built once, so resolve through a ref holding the
      // current tree-path → repo-relative mapping. Directory rows resolve
      // to nothing and are ignored — previews need a file.
      const treePath = selected[0] ?? null;
      if (!treePath) return;
      const relPath = treePathToRelRef.current.get(treePath);
      if (relPath) onOpenFilePreview(relPath);
    },
  });

  const isFirstSync = useRef(true);
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    model.resetPaths(highlightedTreePaths, { initialExpandedPaths: [] });
  }, [model, highlightedTreePaths]);

  useEffect(() => {
    for (const dir of ancestorDirPaths) {
      // getItem accepts a bare directory path; fall back to the trailing-slash
      // canonical form defensively.
      const item = model.getItem(dir) ?? model.getItem(`${dir}/`);
      if (item && 'expand' in item && !item.isExpanded()) item.expand();
    }
  }, [model, ancestorDirPaths]);

  // useFileTree() builds the model once and ignores later option changes, so
  // the gitStatus captured at first render (empty, since both inputs load
  // async) would stick forever. Push updates through the model's imperative
  // setter whenever the resolved entries change.
  useEffect(() => {
    model.setGitStatus(gitStatusEntries);
  }, [model, gitStatusEntries]);

  // Re-clicking an already-selected file is silent — the tree only fires
  // onSelectionChange when the selection *changes* — so a second click on
  // the previewed file would never close its preview. Remember what was
  // selected when the pointer went down, and if the click lands on that
  // same file row, treat it as a toggle-off. (Same approach as FilesPanel.)
  const modelRef = useRef<ReturnType<typeof useFileTree>['model'] | null>(null);
  modelRef.current = model;
  const selectedAtPointerDown = useRef<string | null>(null);
  const handlePointerDownCapture = useCallback(() => {
    selectedAtPointerDown.current =
      modelRef.current?.getSelectedPaths()[0] ?? null;
  }, []);
  const handleClickCapture = useCallback(
    (event: React.MouseEvent) => {
      // Rows live in the FileTree web component's shadow DOM; click events
      // are composed, so composedPath() exposes the row element and its
      // `data-item-path` / `data-item-type` attributes (set by @pierre/trees).
      const row = event.nativeEvent
        .composedPath()
        .find(
          (element): element is HTMLElement =>
            element instanceof HTMLElement &&
            element.getAttribute('data-item-path') != null,
        );
      if (!row || row.getAttribute('data-item-type') !== 'file') return;
      const treePath = row.getAttribute('data-item-path');
      // Only the re-click-on-the-selected-row case; clicks that change the
      // selection flow through onSelectionChange and never double-fire.
      if (!treePath || treePath !== selectedAtPointerDown.current) return;
      if (!treePathToRelRef.current.get(treePath)) return;
      onCloseFilePreview();
    },
    [onCloseFilePreview],
  );

  if (isResolvingTree || !fileTree) {
    return (
      <div className="acp-session__file-city">
        <div className="acp-session__tool-panel-empty" role="status">
          <Building2 size={15} />
          <span>Matching highlights against workspace files…</span>
        </div>
      </div>
    );
  }

  if (highlightedTreePaths.length === 0) {
    return (
      <div className="acp-session__file-city">
        <div className="acp-session__tool-panel-empty" role="status">
          <Building2 size={15} />
          <span>No highlighted files match the workspace file tree.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="acp-session__file-city acp-session__highlight-tree-pierre"
      onPointerDownCapture={handlePointerDownCapture}
      onClickCapture={handleClickCapture}
    >
      <ThemedFileTree
        model={model}
        gitStatusColors
        style={
          {
            '--trees-padding-inline-override': '0px',
            '--trees-item-padding-x-override': '4px',
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function ACPFileDiffPreview({
  workspacePath,
  relPath,
  onClose,
}: {
  workspacePath: string;
  relPath: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const [diffText, setDiffText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDiffText(null);
    void GitService.getWorkingTreeDiff(workspacePath)
      .then((text) => {
        if (!cancelled) setDiffText(text ?? '');
      })
      .catch(() => {
        if (!cancelled) setDiffText('');
      });
    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  // Split the working-tree patch the way ReviewCommitPanel does (so one
  // malformed file header can't drop every file) and take the chunk for
  // this file. Anything without a matching chunk — untracked, unchanged,
  // or read-only highlights — falls back to the current file content.
  const fileDiff = useMemo<FileDiffMetadata | undefined>(() => {
    if (!diffText) return undefined;
    const chunks = diffText
      .split(/(?=^diff --git )/m)
      .filter((chunk) => chunk.trim().length > 0);
    const target = chunks.find((chunk) => {
      const plusTarget = /^\+{3}\s+(.+)$/m
        .exec(chunk)?.[1]
        ?.trim()
        .replace(/^b\//, '');
      if (plusTarget && normalizeWorkspacePath(plusTarget) === relPath) {
        return true;
      }
      const gitTarget = /^diff --git\s+\S+\s+(\S+)\s*$/m
        .exec(chunk)?.[1]
        ?.trim()
        .replace(/^b\//, '');
      return !!gitTarget && normalizeWorkspacePath(gitTarget) === relPath;
    });
    if (!target) return undefined;
    try {
      return parsePatchFiles(target).flatMap((patch) => patch.files)[0];
    } catch {
      return undefined;
    }
  }, [diffText, relPath]);

  const fileName = relPath.split('/').pop() || relPath;

  return (
    <div className="acp-session__file-preview">
      <div className="acp-session__file-preview-head">
        <code className="acp-session__file-preview-path">{relPath}</code>
        <button
          type="button"
          aria-label="Close file preview"
          title="Close file preview"
          className="acp-session__file-preview-close"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="acp-session__file-preview-body">
        {diffText === null ? (
          <div className="acp-session__topic-preview-message" role="status">
            <Loader2 className="acp-client__spinning" size={15} />
            Loading diff…
          </div>
        ) : fileDiff ? (
          <FileDiff
            fileDiff={fileDiff}
            options={{
              diffStyle: 'unified',
            }}
            style={{
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.monospace,
            }}
          />
        ) : (
          <>
            <div className="acp-session__file-preview-note" role="status">
              No working-tree diff for this file — showing its current content.
            </div>
            <PierreFileView
              filePath={`${workspacePath}/${relPath}`}
              fileName={fileName}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function ACPSessionView({
  agent,
  workspacePath,
  repository,
  sessionTitle,
  messages,
  permissions,
  isPrompting,
  modelSelection,
  modelError,
  onModelChange,
  onSend,
  onStop,
  onRespondPermission,
}: ACPSessionViewProps) {
  const { theme } = useTheme();
  const [activityView, setActivityView] =
    useState<ACPActivityView>('artifacts');
  const [selectedArtifact, setSelectedArtifact] =
    useState<AcpArtifactRef | null>(null);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<string | null>(
    null,
  );
  const [filePreviewClosing, setFilePreviewClosing] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicPreviewClosing, setTopicPreviewClosing] = useState(false);
  const [selectedTopicReference, setSelectedTopicReference] =
    useState<AcpTopicReference | null>(null);
  const [selectedModelReference, setSelectedModelReference] =
    useState<AcpModelReference | null>(null);
  const [selectedDrawingReference, setSelectedDrawingReference] =
    useState<AcpDrawingReference | null>(null);
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
  const selectedTopicId =
    selectedArtifact?.kind === 'topic' ? selectedArtifact.id : null;

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
        Math.max(20, Math.min(100, resize.startHeight + deltaPercent)),
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
          Math.max(20, Math.min(100, height + delta)),
        );
      } else if (event.key === 'Home') {
        event.preventDefault();
        setTopicPreviewHeight(20);
      } else if (event.key === 'End') {
        event.preventDefault();
        setTopicPreviewHeight(100);
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
    const reference =
      selectedTopicReference ??
      selectedModelReference ??
      selectedDrawingReference ??
      undefined;
    setSelectedTopicReference(null);
    setSelectedModelReference(null);
    setSelectedDrawingReference(null);
    onSend(text, reference);
  };
  const openArtifactPreview = useCallback(
    (artifact: AcpArtifactRef) => {
      const isSame =
        selectedArtifact?.kind === artifact.kind &&
        selectedArtifact.id === artifact.id;
      if (isSame) {
        if (topicPreviewClosing) {
          setTopicPreviewClosing(false);
          return;
        }
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          setSelectedArtifact(null);
          return;
        }
        setTopicPreviewClosing(true);
        return;
      }
      setSelectedTopicReference(null);
      setSelectedModelReference(null);
      setSelectedDrawingReference(null);
      setTopicPreviewClosing(false);
      setFilePreviewClosing(false);
      setSelectedPreviewFile(null);
      setSelectedArtifact(artifact);
    },
    [selectedArtifact, topicPreviewClosing],
  );
  const finishTopicPreviewClose = useCallback(
    (event: React.AnimationEvent<HTMLElement>) => {
      if (event.animationName !== 'acp-topic-preview-exit') return;
      setTopicPreviewClosing(false);
      setSelectedArtifact(null);
    },
    [],
  );
  /**
   * A highlighted file focused in the file-tree preview opens over the chat,
   * like an artifact. Opening a file clears any artifact preview; opening an
   * artifact clears the file preview.
   */
  const openFilePreview = useCallback((relPath: string) => {
    setSelectedTopicReference(null);
    setSelectedModelReference(null);
    setTopicPreviewClosing(false);
    setSelectedArtifact(null);
    setFilePreviewClosing(false);
    setSelectedPreviewFile(relPath);
  }, []);
  const closeFilePreview = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setSelectedPreviewFile(null);
      return;
    }
    setFilePreviewClosing(true);
  }, []);
  const finishFilePreviewClose = useCallback(
    (event: React.AnimationEvent<HTMLElement>) => {
      if (event.animationName !== 'acp-topic-preview-exit') return;
      setFilePreviewClosing(false);
      setSelectedPreviewFile(null);
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
  /**
   * A trail (or step) focused in the subsystem model preview becomes the
   * pending chat reference, like a text selection in a topic preview. Clearing
   * the focus keeps the last attached reference; switching artifacts, removing
   * the chip, or sending clears it.
   */
  const handleModelTrailSelect = useCallback(
    (selection: SubsystemTrailSelection | null) => {
      const modelId =
        selectedArtifact?.kind === 'subsystem-model'
          ? selectedArtifact.id
          : null;
      if (!modelId || !selection) return;
      const stepIndex = selection.stepIndices?.[0];
      void SubsystemModelService.get(modelId)
        .then((model) => {
          if (!model) return;
          if (
            selectedArtifact?.kind !== 'subsystem-model' ||
            selectedArtifact.id !== modelId
          ) {
            return;
          }
          const trail = model.trails?.find(
            (candidate) => candidate.id === selection.trailId,
          );
          if (!trail) return;
          const step =
            stepIndex === undefined ? undefined : trail.steps[stepIndex];
          setSelectedModelReference({
            modelId,
            modelTitle: model.title,
            trailId: trail.id,
            trailTitle: trail.title,
            stepIndex: step === undefined ? undefined : stepIndex,
            stepSummary:
              step === undefined || stepIndex === undefined
                ? describeModelTrail(trail)
                : describeModelStep(trail, step, stepIndex),
          });
        })
        .catch(() => {
          // A model that cannot be read cannot be referenced; leave the
          // composer without a reference rather than attaching a guess.
        });
    },
    [selectedArtifact],
  );
  /**
   * Drawing pieces clicked in the drawing preview become the pending chat
   * reference, like a focused model trail. Clearing the canvas selection
   * keeps the last attached reference; switching artifacts, removing the
   * chip, or sending clears it.
   */
  const handleDrawingElementSelect = useCallback(
    (selection: DrawingElementSelection | null) => {
      const drawing =
        selectedArtifact?.kind === 'drawing' ? selectedArtifact : null;
      if (!drawing || !selection || selection.elements.length === 0) return;
      const elementIds = selection.elements.map((element) => element.id);
      setSelectedDrawingReference({
        drawingId: drawing.id,
        drawingName: drawing.title,
        elementIds,
        elementSummary: describeDrawingElements(selection.elements),
      });
    },
    [selectedArtifact],
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
  const artifactPreview = selectedArtifact ? (
    <section
      className={`acp-session__topic-preview${topicPreviewClosing ? ' is-closing' : ''}`}
      style={
        {
          height: `${topicPreviewHeight}%`,
          '--acp-topic-preview-height': `${topicPreviewHeight}%`,
        } as React.CSSProperties
      }
      role="region"
      aria-label={`${artifactKindLabel(selectedArtifact.kind)} preview: ${
        selectedArtifact.kind === 'topic'
          ? (selectedTopic?.title ?? selectedArtifact.title)
          : selectedArtifact.title
      }`}
      onAnimationEnd={finishTopicPreviewClose}
    >
      <div
        className={`acp-session__topic-preview-content${
          selectedArtifact.kind === 'topic'
            ? ''
            : ' acp-session__topic-preview-content--graph'
        }`}
      >
        {selectedArtifact.kind === 'subsystem-model' ? (
          <SubsystemModelTabContent
            modelId={selectedArtifact.id}
            onTrailSelect={handleModelTrailSelect}
          />
        ) : selectedArtifact.kind === 'drawing' ? (
          <ACPDrawingPreview
            drawingId={selectedArtifact.id}
            onElementSelect={handleDrawingElementSelect}
          />
        ) : topicPreviewLoading && !selectedTopic ? (
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
        aria-label="Resize preview"
        aria-orientation="horizontal"
        aria-valuemin={20}
        aria-valuemax={100}
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

  const filePreview = selectedPreviewFile ? (
    <section
      className={`acp-session__topic-preview${filePreviewClosing ? ' is-closing' : ''}`}
      style={
        {
          height: `${topicPreviewHeight}%`,
          '--acp-topic-preview-height': `${topicPreviewHeight}%`,
        } as React.CSSProperties
      }
      role="region"
      aria-label={`File preview: ${selectedPreviewFile}`}
      onAnimationEnd={finishFilePreviewClose}
    >
      <div className="acp-session__topic-preview-content acp-session__topic-preview-content--file">
        <ACPFileDiffPreview
          key={selectedPreviewFile}
          workspacePath={workspacePath}
          relPath={selectedPreviewFile}
          onClose={closeFilePreview}
        />
      </div>
      <div
        className="acp-session__topic-preview-resize"
        role="separator"
        aria-label="Resize preview"
        aria-orientation="horizontal"
        aria-valuemin={20}
        aria-valuemax={100}
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
        <ACPWorkspaceIdentity sessionTitle={sessionTitle} />
        <div
          className="acp-session__activity-switch"
          role="tablist"
          aria-label="Activity view"
        >
          <button
            className={activityView === 'artifacts' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activityView === 'artifacts'}
            onClick={() => setActivityView('artifacts')}
          >
            Artifacts
          </button>
          <button
            className={activityView === 'tools' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activityView === 'tools'}
            onClick={() => setActivityView('tools')}
          >
            Tools
          </button>
        </div>
      </header>

      <div className="acp-session__workspace">
        <div className="acp-session__main">
          <div className="acp-session__chat-viewport" ref={chatViewportRef}>
            {artifactPreview}
            {filePreview}
            <div
              className="acp-session__messages"
              role="log"
              aria-live={selectedArtifact ? 'off' : 'polite'}
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
                  {!hasToolCalls &&
                  modelSelection &&
                  modelSelection.options.length > 0 ? (
                    <div className="acp-session__model-picker">
                      <span className="acp-session__model-picker-label">
                        <Cpu size={13} aria-hidden="true" /> Model
                      </span>
                      <ACPModelPicker
                        disabled={isPrompting}
                        error={modelError}
                        onChange={(model) => onModelChange?.(model)}
                        selection={modelSelection}
                      />
                    </div>
                  ) : null}
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
                            isAcpTopicReference(message.reference) ? (
                              <div className="acp-session__message-reference">
                                <TopicsIcon size={13} strokeWidth={1.5} />
                                <span>
                                  Reference · {message.reference.topicTitle}
                                </span>
                                <blockquote>
                                  {message.reference.anchor.exact}
                                </blockquote>
                              </div>
                            ) : isAcpModelReference(message.reference) ? (
                              <div className="acp-session__message-reference">
                                <Network size={13} strokeWidth={1.5} />
                                <span>
                                  Reference · {message.reference.trailTitle}
                                </span>
                                <blockquote>
                                  {message.reference.stepSummary}
                                </blockquote>
                              </div>
                            ) : (
                              <div className="acp-session__message-reference">
                                <PenTool size={13} strokeWidth={1.5} />
                                <span>
                                  Reference · {message.reference.drawingName}
                                </span>
                                <blockquote>
                                  {message.reference.elementSummary}
                                </blockquote>
                              </div>
                            )
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
            ) : selectedModelReference ? (
              <div className="acp-session__reference-chip">
                <Network size={15} strokeWidth={1.5} />
                <span>
                  <strong>
                    Reference · {selectedModelReference.trailTitle}
                  </strong>
                  <small>
                    {selectedModelReference.stepSummary.split('\n')[0]}
                  </small>
                </span>
                <button
                  type="button"
                  aria-label="Remove model reference"
                  onClick={() => setSelectedModelReference(null)}
                >
                  <X size={14} />
                </button>
              </div>
            ) : selectedDrawingReference ? (
              <div className="acp-session__reference-chip">
                <PenTool size={15} strokeWidth={1.5} />
                <span>
                  <strong>
                    Reference · {selectedDrawingReference.drawingName}
                  </strong>
                  <small>
                    {selectedDrawingReference.elementSummary.split('\n')[0]}
                  </small>
                </span>
                <button
                  type="button"
                  aria-label="Remove drawing reference"
                  onClick={() => setSelectedDrawingReference(null)}
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
          selectedArtifact={selectedArtifact}
          onOpenArtifact={openArtifactPreview}
          onOpenFilePreview={openFilePreview}
          onCloseFilePreview={closeFilePreview}
        />
      </div>
    </main>
  );
}

export default ACPSessionView;
