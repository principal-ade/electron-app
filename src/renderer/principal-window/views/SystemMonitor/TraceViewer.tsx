import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { OtelCollectorService, type StoredTrace } from '../../../main-process-api/OtelCollectorService';
import { RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());

  // Fetch traces
  const fetchTraces = async () => {
    try {
      const result = await OtelCollectorService.getTraces(20);
      if (result.success) {
        setTraces(result.traces);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch traces');
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch traces:', err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  // Auto-refresh traces
  useEffect(() => {
    fetchTraces();

    if (autoRefresh) {
      const interval = setInterval(fetchTraces, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

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
                    onClick={() => setSelectedTrace(trace)}
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
                          {new Date(trace.timestamp).toLocaleTimeString()}
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
