/**
 * Translation layer between raw canvas JSON (.scopes.canvas /
 * <scope>.events.canvas) and the in-memory ScopeManager model.
 *
 * Read paths walk the canvas nodes and pluck the `otel-scope` /
 * `event-namespace` entries we care about. Write paths preserve any
 * unrelated nodes, edges, or top-level fields on the original canvas (so
 * round-tripping doesn't trash hand-authored layouts or comments).
 */

import {
  isOtelScopeNode,
  type ExtendedCanvas,
  type ExtendedCanvasNode,
  type OtelScopeNode,
} from '@principal-ai/principal-view-core';
import type {
  EventRecord,
  NamespaceRecord,
  NodePosition,
  ScopeRecord,
} from './types';

/**
 * Canvas JSON loaded from disk. ExtendedCanvas is the strict spec; in practice
 * `.events.canvas` files include top-level fields like `scope` (string) and
 * `type` that aren't on the strict type. We keep `Record<string, unknown>` to
 * preserve them on round-trip.
 */
export type RawCanvas = ExtendedCanvas & Record<string, unknown>;

const DEFAULT_SCOPE_NODE_SIZE = { width: 280, height: 120 };
const DEFAULT_NAMESPACE_NODE_SIZE = { width: 250, height: 150 };
const VERTICAL_LAYOUT_GAP = 50;

/** Detect a raw event-namespace node by its `type` discriminator. */
function isEventNamespaceNode(node: unknown): node is RawEventNamespaceNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'event-namespace'
  );
}

/** Loose alias that admits unknown extra fields surviving round-trip. */
type RawNode = ExtendedCanvasNode | Record<string, unknown>;

interface RawEventNamespaceNode {
  id: string;
  type: 'event-namespace';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  namespace: {
    name: string;
    description?: string;
    paths?: string[];
    events?: EventRecord[];
  };
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export function parseScopesCanvas(canvas: RawCanvas | null | undefined): {
  scopes: ScopeRecord[];
} {
  if (!canvas?.nodes) return { scopes: [] };
  const scopes: ScopeRecord[] = [];
  for (const node of canvas.nodes) {
    if (!isOtelScopeNode(node)) continue;
    scopes.push(scopeNodeToRecord(node));
  }
  return { scopes };
}

export function parseEventsCanvas(canvas: RawCanvas | null | undefined): {
  scopeName: string | null;
  namespaces: NamespaceRecord[];
} {
  if (!canvas) return { scopeName: null, namespaces: [] };
  const scopeName =
    typeof (canvas as Record<string, unknown>).scope === 'string'
      ? ((canvas as Record<string, unknown>).scope as string)
      : null;
  const namespaces: NamespaceRecord[] = [];
  for (const node of canvas.nodes ?? []) {
    if (!isEventNamespaceNode(node)) continue;
    namespaces.push(namespaceNodeToRecord(node));
  }
  return { scopeName, namespaces };
}

function scopeNodeToRecord(node: OtelScopeNode): ScopeRecord {
  const otelScope = node.otel?.scope;
  // `paths` and `status` aren't on the strict OtelScopeNode type in the
  // currently-installed core lib but exist in real-world canvases — read
  // through an unknown cast so we don't lose them on round-trip.
  const loose = node as unknown as {
    paths?: unknown;
    label?: unknown;
    otel?: { status?: unknown; description?: unknown };
  };
  // Spec puts `description` at the top level of OtelScopeNode, but legacy
  // canvases authored before that put it inside `otel.description`. Fall back
  // so we don't drop the field on round-trip.
  const description =
    typeof node.description === 'string'
      ? node.description
      : typeof loose.otel?.description === 'string'
        ? loose.otel.description
        : undefined;
  return {
    name: otelScope ?? node.id,
    description,
    paths: Array.isArray(loose.paths)
      ? (loose.paths as unknown[]).filter((p): p is string => typeof p === 'string')
      : [],
    color: typeof node.color === 'string' ? node.color : undefined,
    status:
      typeof loose.otel?.status === 'string' ? loose.otel.status : undefined,
    label: typeof loose.label === 'string' ? loose.label : undefined,
    namespaces: [],
    nodeId: node.id,
    position: {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    },
  };
}

function namespaceNodeToRecord(node: RawEventNamespaceNode): NamespaceRecord {
  return {
    name: node.namespace.name,
    description: node.namespace.description ?? '',
    paths: node.namespace.paths ?? [],
    events: node.namespace.events ?? [],
    color: node.color,
    nodeId: node.id,
    position: {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    },
  };
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

export function serializeScopesCanvas(
  scopes: readonly ScopeRecord[],
  existing?: RawCanvas | null,
): RawCanvas {
  const base: RawCanvas = existing
    ? { ...existing }
    : {
        name: 'Scopes',
        nodes: [],
        edges: [],
      };

  const existingNodes = (existing?.nodes ?? []) as ExtendedCanvasNode[];
  const preservedNodes = existingNodes.filter(
    (n): n is ExtendedCanvasNode => !isOtelScopeNode(n),
  );

  const scopeNodes = scopes.map((scope, idx) =>
    scopeRecordToNode(scope, idx, existingNodes),
  );

  base.nodes = [
    ...preservedNodes,
    ...(scopeNodes as unknown as ExtendedCanvasNode[]),
  ];
  return base;
}

export function serializeEventsCanvas(
  scopeName: string,
  namespaces: readonly NamespaceRecord[],
  existing?: RawCanvas | null,
): RawCanvas {
  const base: RawCanvas = existing
    ? { ...existing }
    : (({
        name: `${scopeName} Events`,
        type: 'event-namespace',
        scope: scopeName,
        nodes: [],
        edges: [],
      } as unknown) as RawCanvas);

  // Always force the scope tag to match — protects against drift.
  (base as Record<string, unknown>).scope = scopeName;

  const existingNodes = (existing?.nodes ?? []) as ExtendedCanvasNode[];
  const preservedNodes = existingNodes.filter(
    (n): n is ExtendedCanvasNode => !isEventNamespaceNode(n),
  );

  const namespaceNodes = namespaces.map((ns, idx) =>
    namespaceRecordToNode(ns, idx, existingNodes),
  );

  base.nodes = [
    ...preservedNodes,
    ...(namespaceNodes as unknown as ExtendedCanvasNode[]),
  ];
  return base;
}

function scopeRecordToNode(
  scope: ScopeRecord,
  index: number,
  existingNodes: readonly RawNode[],
): OtelScopeNode {
  const id = scope.nodeId ?? slugifyId(`scope-${scope.name}`);
  const position =
    scope.position ?? autoPosition(existingNodes, index, DEFAULT_SCOPE_NODE_SIZE);
  // OtelScopeNode in the installed core typings doesn't include `paths` or
  // `label` even though real canvases have them — assemble as a Record and
  // cast at the end.
  const node: Record<string, unknown> = {
    id,
    type: 'otel-scope',
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    description: scope.description,
    otel: {
      scope: scope.name,
      ...(scope.status ? { status: scope.status } : {}),
    },
  };
  if (scope.paths.length > 0) node.paths = scope.paths;
  if (scope.color) node.color = scope.color;
  if (scope.label) node.label = scope.label;
  return node as unknown as OtelScopeNode;
}

function namespaceRecordToNode(
  ns: NamespaceRecord,
  index: number,
  existingNodes: readonly RawNode[],
): RawEventNamespaceNode {
  const id = ns.nodeId ?? slugifyId(ns.name);
  const position =
    ns.position ?? autoPosition(existingNodes, index, DEFAULT_NAMESPACE_NODE_SIZE);
  const node: RawEventNamespaceNode = {
    id,
    type: 'event-namespace',
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    namespace: {
      name: ns.name,
      description: ns.description,
      ...(ns.paths.length > 0 ? { paths: ns.paths } : {}),
      events: ns.events,
    },
  };
  if (ns.color) node.color = ns.color;
  return node;
}

function autoPosition(
  existingNodes: readonly RawNode[],
  index: number,
  size: { width: number; height: number },
): NodePosition {
  // Stack new nodes vertically below the lowest existing node so authored
  // layouts stay intact. Falls back to (100, 100) when the canvas is empty.
  let maxBottom = 100;
  for (const n of existingNodes) {
    if (
      typeof (n as { y?: number }).y === 'number' &&
      typeof (n as { height?: number }).height === 'number'
    ) {
      const bottom =
        (n as { y: number }).y + (n as { height: number }).height;
      if (bottom > maxBottom) maxBottom = bottom;
    }
  }
  return {
    x: 100,
    y: maxBottom + VERTICAL_LAYOUT_GAP + index * (size.height + VERTICAL_LAYOUT_GAP),
    width: size.width,
    height: size.height,
  };
}

function slugifyId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
