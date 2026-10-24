import { context, trace, TraceFlags } from '@opentelemetry/api';
import {
  contextFromTraceparent,
  currentTraceparent,
  parseTraceparent,
  traceparentFromSpanContext,
} from './traceparent';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const SPAN_ID = '00f067aa0ba902b7';
const VALID = `00-${TRACE_ID}-${SPAN_ID}-01`;

describe('parseTraceparent', () => {
  it('parses a valid v00 trace context', () => {
    expect(parseTraceparent(VALID)).toEqual({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      sampled: true,
    });
  });

  it('accepts an unsampled flag', () => {
    expect(parseTraceparent(`00-${TRACE_ID}-${SPAN_ID}-00`)?.sampled).toBe(
      false,
    );
  });

  it('is case- and whitespace-insensitive', () => {
    expect(parseTraceparent(` 00-${TRACE_ID.toUpperCase()}-${SPAN_ID}-01 `)).toMatchObject({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['empty', ''],
    ['no dashes', `${TRACE_ID}${SPAN_ID}`],
    ['short trace id', `00-${TRACE_ID.slice(1)}-${SPAN_ID}-01`],
    ['short span id', `00-${TRACE_ID}-${SPAN_ID.slice(1)}-01`],
    ['bad flags', `00-${TRACE_ID}-${SPAN_ID}-zz`],
    ['forbidden version ff', `ff-${TRACE_ID}-${SPAN_ID}-01`],
    ['zero trace id', `00-${'0'.repeat(32)}-${SPAN_ID}-01`],
    ['zero span id', `00-${TRACE_ID}-${'0'.repeat(16)}-01`],
  ])('rejects %s', (_label, value) => {
    expect(parseTraceparent(value)).toBeNull();
  });
});

describe('contextFromTraceparent', () => {
  it('attaches the remote span context', () => {
    const ctx = contextFromTraceparent(VALID);
    const span = ctx && trace.getSpan(ctx);
    expect(span?.spanContext()).toMatchObject({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      traceFlags: TraceFlags.SAMPLED,
      isRemote: true,
    });
  });

  it('returns null rather than inventing a context', () => {
    expect(contextFromTraceparent('nope')).toBeNull();
    expect(contextFromTraceparent(undefined)).toBeNull();
  });
});

describe('traceparentFromSpanContext', () => {
  it('round-trips through parseTraceparent', () => {
    const value = traceparentFromSpanContext({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      traceFlags: TraceFlags.SAMPLED,
    });

    expect(value).toBe(`00-${TRACE_ID}-${SPAN_ID}-01`);
    expect(parseTraceparent(value)).toEqual({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      sampled: true,
    });
  });

  it('marks unsampled contexts', () => {
    expect(
      traceparentFromSpanContext({
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        traceFlags: TraceFlags.NONE,
      }),
    ).toBe(`00-${TRACE_ID}-${SPAN_ID}-00`);
  });

  it('refuses invalid span contexts', () => {
    expect(
      traceparentFromSpanContext({
        traceId: '00000000000000000000000000000000',
        spanId: SPAN_ID,
        traceFlags: TraceFlags.SAMPLED,
      }),
    ).toBeUndefined();
  });
});

describe('currentTraceparent', () => {
  // The app registers no context manager, so there is no "active" span to read.
  // Callers hold the span they created and use traceparentFromSpan instead.
  it('is undefined without an active span', () => {
    const ctx = trace.setSpanContext(context.active(), {
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      traceFlags: TraceFlags.SAMPLED,
    });

    expect(context.with(ctx, () => currentTraceparent())).toBeUndefined();
  });
});
