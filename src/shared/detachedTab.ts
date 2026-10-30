/**
 * Detached workspace tab contract.
 *
 * A detached tab is a *serializable descriptor* — never a React node, callback,
 * or live session. The main process owns the transfer state (see
 * `src/main/window/detachedTabHandlers.ts`); renderers only ever exchange an
 * opaque transfer token plus this descriptor.
 *
 * Only content that reloads by identity — topics, subsystem models, and C4
 * sketches. Terminals, editors, and drawings (which carry live state) are out of
 * scope until their own state-transfer paths exist.
 */

export type DetachableTabKind = 'local-topic' | 'subsystem-model' | 'c4-sketch';

/** Content types a detached window can host today. */
export const DETACHABLE_TAB_KINDS: readonly DetachableTabKind[] = [
  'local-topic',
  'subsystem-model',
  'c4-sketch',
];

/** Hard caps on untrusted IPC strings. */
const MAX_ID_LENGTH = 512;
const MAX_LABEL_LENGTH = 512;

/**
 * The complete, serializable identity of a detachable workspace tab.
 *
 * `tabId` is the *source* workspace tab id (`local-topic-<id>`,
 * `subsystem-model-<id>`). The destination window is keyed by it, and the
 * source removes exactly this tab once the destination accepts.
 */
export interface DetachableTabDescriptor {
  kind: DetachableTabKind;
  tabId: string;
  label: string;
  /** `local-topic` payload. */
  topicId?: string;
  title?: string;
  /** `subsystem-model` payload. */
  modelId?: string;
  /** `c4-sketch` payload. */
  sketchId?: string;
}

/**
 * Screen coordinates where a drag-out was released. Main opens the new window
 * there (clamped to that display) so the window appears where the tab landed.
 */
export interface DetachedTabDropPoint {
  screenX: number;
  screenY: number;
}

export interface DetachedTabOpenOptions {
  dropPoint?: DetachedTabDropPoint;
}

/** Result of asking main to open a detached window for a tab. */
export interface DetachedTabOpenResult {
  ok: boolean;
  windowId?: number;
  /**
   * True only when the destination accepted the tab. The source may remove its
   * copy **only** in this case.
   */
  transferred: boolean;
  /** A window for this tab id was already open and was focused instead. */
  alreadyOpen?: boolean;
  reason?: string;
}

/** Result of returning a detached tab to the main window. */
export interface DetachedTabReturnResult {
  ok: boolean;
  reason?: string;
}

/** Payload main sends to the intended receiver of a return transfer. */
export interface DetachedTabIncomingPayload {
  /** Opaque transfer token. The receiver must claim it to get the descriptor. */
  token: string;
}

function isString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maxLength
  );
}

function isOptionalString(value: unknown, maxLength: number): boolean {
  return value === undefined || isString(value, maxLength);
}

/** Validate untrusted drop coordinates; anything non-finite is ignored. */
export function isDetachedTabDropPoint(
  value: unknown,
): value is DetachedTabDropPoint {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['screenX'] === 'number' &&
    Number.isFinite(candidate['screenX']) &&
    typeof candidate['screenY'] === 'number' &&
    Number.isFinite(candidate['screenY'])
  );
}

/**
 * Validate an untrusted descriptor arriving over IPC. Rejects unknown kinds,
 * missing identity fields, and oversized strings.
 */
export function isDetachableTabDescriptor(
  value: unknown,
): value is DetachableTabDescriptor {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const kind = candidate['kind'];
  if (
    kind !== 'local-topic' &&
    kind !== 'subsystem-model' &&
    kind !== 'c4-sketch'
  ) {
    return false;
  }
  if (
    !isString(candidate['tabId'], MAX_ID_LENGTH) ||
    !isString(candidate['label'], MAX_LABEL_LENGTH) ||
    !isOptionalString(candidate['topicId'], MAX_ID_LENGTH) ||
    !isOptionalString(candidate['title'], MAX_LABEL_LENGTH) ||
    !isOptionalString(candidate['modelId'], MAX_ID_LENGTH) ||
    !isOptionalString(candidate['sketchId'], MAX_ID_LENGTH)
  ) {
    return false;
  }
  // Each kind must carry its reload key; otherwise the destination can only
  // render an error and the source would be removed for nothing.
  if (kind === 'local-topic') {
    return isString(candidate['topicId'], MAX_ID_LENGTH);
  }
  if (kind === 'c4-sketch') {
    return isString(candidate['sketchId'], MAX_ID_LENGTH);
  }
  return isString(candidate['modelId'], MAX_ID_LENGTH);
}
