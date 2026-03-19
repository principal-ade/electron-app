import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { OtelCollectorService, type StoredTrace } from '../../../main-process-api/OtelCollectorService';
import { RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { getTracer } from '../../../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

// OTLP KeyValue type (internal to @opentelemetry/otlp-transformer)
type OTLPKeyValue = {
  key: string;
  value?: {
    stringValue?: string | null;
    boolValue?: boolean | null;
    intValue?: number | null;
  };
};

interface TraceViewerProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface GroupedTraces {
  [source: string]: StoredTrace[];
}

export const TraceViewer: React.FC<TraceViewerProps> = ({
  autoRefresh = true,
  refreshInterval = 2000,
}) => {
  const { theme } = useTheme();
  const [traces, setTraces] = useState<StoredTrace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<StoredTrace | null>(null);
  const renderStartTime = useRef<number>(0);

  // Handle trace selection with instrumentation
  const handleTraceSelect = (trace: StoredTrace) => {
    const tracer = getTracer('principal-ade-principal-window');
    const span = tracer.startSpan('otel.trace.visualization');

    // Count spans in trace
    const spansCount = trace.data?.resourceSpans?.reduce((acc, rs) => {
      return acc + (rs.scopeSpans?.reduce((sacc, ss) => sacc + (ss.spans?.length || 0), 0) || 0);
    }, 0) || 0;

    // Event: Trace selected in DevWorkspace
    span.addEvent('otel.devworkspace.trace_selected', {
      'trace.id': trace.traceId,
      'tab.label': `Trace ${trace.traceId.substring(0, 8)}`,
      'tab.id': `trace-${trace.traceId}`,
      'spans.count': spansCount,
    });

    renderStartTime.current = performance.now();
    setSelectedTrace(trace);

    // Event: Panel rendered (measure after state update)
    requestAnimationFrame(() => {
      const renderDuration = performance.now() - renderStartTime.current;
      span.addEvent('otel.panel.trace_rendered', {
        'trace.id': trace.traceId,
        'spans.count': spansCount,
        'render.duration_ms': Math.round(renderDuration),
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());

  // Fetch traces
  const fetchTraces = useCallback(async () => {
    const tracer = getTracer('principal-ade-principal-window');
    const span = tracer.startSpan('otel.trace.visualization');

    try {
      const result = await OtelCollectorService.getTraces(20);
      if (result.success) {
        setTraces(result.traces);
        setError(null);

        // Extract unique services from traces
        const services = new Set<string>();
        result.traces.forEach((trace) => {
          const attrs = trace.data?.resourceSpans?.[0]?.resource?.attributes;
          const serviceAttr = attrs?.find((a: { key: string }) => a.key === 'service.name');
          if (serviceAttr?.value?.stringValue) {
            services.add(serviceAttr.value.stringValue);
          }
        });

        // Event: SystemMonitor polled traces
        span.addEvent('otel.systemmonitor.traces_polled', {
          'traces.fetched': result.traces.length,
          'traces.limit': 20,
          'services.count': services.size,
          'poll.interval_ms': refreshInterval,
        });

        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        setError(result.error || 'Failed to fetch traces');
        span.setStatus({ code: SpanStatusCode.ERROR, message: result.error || 'Failed to fetch traces' });
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch traces:', err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
    } finally {
      span.end();
    }
  }, [refreshInterval]);

  // Auto-refresh traces
  useEffect(() => {
    fetchTraces();

    if (autoRefresh) {
      const interval = setInterval(fetchTraces, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchTraces]);

  // Extract service name from trace data
  const extractSource = (trace: StoredTrace): string => {
    try {
      // OTLP format: resourceSpans[0].resource.attributes
      const attributes = trace.data?.resourceSpans?.[0]?.resource?.attributes;
      if (attributes) {
        const serviceAttr = attributes.find((attr: OTLPKeyValue) => attr.key === 'service.name');
        if (serviceAttr?.value?.stringValue) {
          return serviceAttr.value.stringValue;
        }
      }
      return 'Unknown Service';
    } catch {
      return 'Unknown Service';
    }
  };

  // Extract timestamp from OTLP span data
  const extractTimestamp = (trace: StoredTrace): number => {
    try {
      // Get first span's start time (nanoseconds)
      const startTimeNano = trace.data?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.startTimeUnixNano;
      if (startTimeNano) {
        // Convert nanoseconds to milliseconds
        // Handle both string, number, and bigint formats
        let nanoTime: number;
        if (typeof startTimeNano === 'string') {
          nanoTime = parseInt(startTimeNano, 10);
        } else if (typeof startTimeNano === 'bigint') {
          nanoTime = Number(startTimeNano);
        } else {
          nanoTime = startTimeNano as number;
        }
        return Math.floor(nanoTime / 1_000_000);
      }
      return Date.now();
    } catch {
      return Date.now();
    }
  };

  // Group traces by source
  const groupedTraces = useMemo(() => {
    const groups: GroupedTraces = {};
    traces.forEach((trace) => {
      const source = extractSource(trace);
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(trace);
    });
    return groups;
  }, [traces]);

  // Toggle source collapse state
  const toggleSource = (source: string) => {
    setCollapsedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  // Clear traces
  const handleClear = async () => {
    try {
      await OtelCollectorService.clearTraces();
      setTraces([]);
      setSelectedTrace(null);
    } catch (err) {
      console.error('Failed to clear traces:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', color: theme.colors.textSecondary }}>
        Loading traces...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: theme.colors.error }}>
        Error: {error}
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <p style={{ margin: 0, fontSize: '14px' }}>
          No traces received yet. Send a test trace to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 600,
            color: theme.colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Received Traces ({traces.length})
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchTraces}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.error}`,
              backgroundColor: `${theme.colors.error}10`,
              color: theme.colors.error,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Trace List - Grouped by Source */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {Object.entries(groupedTraces).map(([source, sourceTraces]) => (
          <div key={source}>
            {/* Source Header */}
            <div
              onClick={() => toggleSource(source)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '8px',
              }}
            >
              {collapsedSources.has(source) ? (
                <ChevronRight size={14} style={{ color: theme.colors.textSecondary }} />
              ) : (
                <ChevronDown size={14} style={{ color: theme.colors.textSecondary }} />
              )}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  {source}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginTop: '2px',
                  }}
                >
                  {sourceTraces.length} trace{sourceTraces.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Traces for this source */}
            {!collapsedSources.has(source) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '8px',
                  marginLeft: '20px',
                }}
              >
                {sourceTraces.map((trace) => (
                  <div
                    key={trace.traceId}
                    onClick={() => handleTraceSelect(trace)}
                    style={{
                      padding: '12px',
                      backgroundColor: selectedTrace?.traceId === trace.traceId
                        ? `${theme.colors.primary}15`
                        : theme.colors.background,
                      border: `1px solid ${selectedTrace?.traceId === trace.traceId ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: theme.colors.text,
                            fontFamily: theme.fonts.monospace,
                          }}
                        >
                          {trace.traceId.substring(0, 16)}...
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            marginTop: '4px',
                          }}
                        >
                          {new Date(extractTimestamp(trace)).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Trace Details */}
      {selectedTrace && (
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h4
            style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Trace Details
          </h4>
          <pre
            style={{
              fontSize: '11px',
              fontFamily: theme.fonts.monospace,
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.background,
              padding: '12px',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '300px',
              margin: 0,
            }}
          >
            {JSON.stringify(selectedTrace.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
