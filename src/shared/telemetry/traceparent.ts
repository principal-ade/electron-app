/**
 * W3C trace context carried across process boundaries by hand.
 *
 * The app does not register a global propagator: main uses `BasicTracerProvider`
 * directly, and the renderer, the utility worker, and the PTY daemon are
 * separate processes talking over TIPC messages and a unix socket. Rather than
 * depend on SDK-global state in each runtime, spans hand their context to the
 * next hop as a plain `traceparent` string, and the receiver re-attaches it.
 *
 * Format (W3C): `00-<32 hex trace id>-<16 hex span id>-<2 hex flags>`.
 */

import { context, trace, TraceFlags, type Context, type Span, type SpanContext } from '@opentelemetry/api';

const INVALID_TRACE_ID = '00000000000000000000000000000000';

export interface ParsedTraceparent {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

/**
 * Serialize a span context for the next process.
 *
 * Spans are passed explicitly rather than read from the active context: this
 * app does not register an OpenTelemetry context manager, so `context.with` and
 * `startActiveSpan` are no-ops here and `trace.getActiveSpan()` is always
 * undefined. Callers hold the span they created and hand it over.
 */
export function traceparentFromSpanContext(
  spanContext: SpanContext,
): string | undefined {
  const { traceId, spanId, traceFlags } = spanContext;
  if (!traceId || traceId === INVALID_TRACE_ID || !spanId) return undefined;

  const flags =
    (traceFlags & TraceFlags.SAMPLED) !== 0
      ? TraceFlags.SAMPLED.toString(16).padStart(2, '0')
      : TraceFlags.NONE.toString(16).padStart(2, '0');

  return `00-${traceId}-${spanId}-${flags}`;
}

/** Serialize a span for the next process. */
export function traceparentFromSpan(span: Span): string | undefined {
  return traceparentFromSpanContext(span.spanContext());
}

/**
 * Serialize the currently active span, when the runtime has a context manager
 * registered. Returns `undefined` otherwise; prefer {@link traceparentFromSpan}.
 */
export function currentTraceparent(): string | undefined {
  const span = trace.getActiveSpan();
  return span ? traceparentFromSpan(span) : undefined;
}

/**
 * Parse a `traceparent` header. Returns `null` for anything that is not a
 * well-formed v00 trace context, so a malformed value can never corrupt a trace.
 */
export function parseTraceparent(
  value: unknown,
): ParsedTraceparent | null {
  if (typeof value !== 'string') return null;

  const match = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(
    value.trim().toLowerCase(),
  );
  if (!match) return null;

  const [, version, traceId, spanId, flags] = match;
  if (version === 'ff') return null;
  if (traceId === INVALID_TRACE_ID) return null;
  if (spanId === '0000000000000000') return null;

  return { traceId, spanId, sampled: (parseInt(flags, 16) & 0x01) === 1 };
}

/**
 * Build a context whose active span context is the remote parent described by
 * `traceparent`. Returns `null` when the value is missing or malformed.
 */
export function contextFromTraceparent(value: unknown): Context | null {
  const parsed = parseTraceparent(value);
  if (!parsed) return null;

  return trace.setSpanContext(context.active(), {
    traceId: parsed.traceId,
    spanId: parsed.spanId,
    traceFlags: parsed.sampled ? TraceFlags.SAMPLED : TraceFlags.NONE,
    isRemote: true,
  });
}
