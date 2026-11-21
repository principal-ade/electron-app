import type { HighlightLayer } from '@principal-ai/file-city-react';
import type {
  AcpFileOperation,
  AcpHighlightItem,
} from '../../../shared/main-process-api-interfaces/AcpAPI';

/**
 * The subset of an ACP tool call the highlight-layer composition needs.
 * Kept structural so the audit story can build layers from recorded cases
 * without pulling in the whole chat-message union.
 */
export interface AcpHighlightToolCall {
  status?: string;
  name?: string;
  kind?: string;
  highlightPaths?: string[];
  highlightItems?: AcpHighlightItem[];
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
export const OPERATION_LAYER_STYLES: Record<
  AcpFileOperation,
  OperationLayerStyle
> = {
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

export const OPERATION_ORDER: AcpFileOperation[] = [
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

export function operationFromTool(
  call: Pick<AcpHighlightToolCall, 'kind' | 'name'>,
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

export function callHighlightItems(
  call: AcpHighlightToolCall,
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

/**
 * Compose the ACP session's tool-call activity into File City highlight
 * layers. Paths are lifted to the strongest operation that touched them, and
 * each operation bucket caps to its newest items.
 *
 * Shared by the live session view and the highlight-audit Storybook surface
 * so recorded cases are mapped through the same rules the app uses.
 */
export function buildAcpHighlightLayers(
  toolCalls: readonly AcpHighlightToolCall[],
  options: { activeColor?: string } = {},
): HighlightLayer[] {
  // Newest first so recency wins ties and each bucket caps to its newest
  // items. Paths are lifted to the strongest operation that touched them.
  // Restored sessions interleave file work with shell calls that have no
  // highlight paths, so filter to contributing calls *before* capping.
  const recentCalls = toolCalls
    .map((call) => ({ call, items: callHighlightItems(call) }))
    .filter(({ items }) => items.length > 0)
    .slice(-60)
    .reverse();
  const activePaths = new Set<string>();
  const byOperation = new Map<
    AcpFileOperation,
    Map<string, AcpHighlightItem>
  >();

  for (const { call, items: callItems } of recentCalls) {
    const isActive = call.status === 'pending' || call.status === 'in_progress';
    for (const item of callItems) {
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
        color: options.activeColor ?? '#6366f1',
        opacity: 1,
        borderWidth: 3,
        priority: 120,
        dynamic: true,
        items: activeItems.slice(0, 40),
      });
    }
  }

  return layers;
}
