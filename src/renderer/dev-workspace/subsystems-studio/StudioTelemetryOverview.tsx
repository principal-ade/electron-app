import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Cpu,
  Gauge,
  Waves,
  X,
} from 'lucide-react';

type Category = 'renderer' | 'rpc' | 'failures' | 'workers';
type ProcessName = 'Renderer' | 'Studio host' | 'Analysis worker';
type Scenario = 'freeze' | 'quiet' | 'disconnected';

interface DemoSpan {
  name: string;
  process: ProcessName;
  durationMs: number;
  attributes: Array<[string, string]>;
  failed?: boolean;
}

interface DemoEvent {
  id: string;
  time: string;
  title: string;
  operation: string;
  durationMs: number;
  summary: string;
  traceId: string;
  spans: DemoSpan[];
}

interface StudioTheme {
  fontSizes: number[];
  fonts: { body: string };
  colors: {
    text: string;
    textSecondary: string;
    background: string;
    backgroundSecondary: string;
    border: string;
  };
}

const processColors: Record<ProcessName, string> = {
  Renderer: '#a78bfa',
  'Studio host': '#38bdf8',
  'Analysis worker': '#34d399',
};

const freezeEvents: DemoEvent[] = [
  {
    id: 'model-open',
    time: '10:42:18',
    title: 'Subsystem model took 5.2s to open',
    operation: 'subsystem-model.open',
    durationMs: 5200,
    summary:
      'The host returned the model quickly; most of the delay was a long renderer task while preparing the graph.',
    traceId: '3fb7a941…c28d',
    spans: [
      {
        name: 'subsystem-model.open',
        process: 'Renderer',
        durationMs: 5200,
        attributes: [
          ['studio.tab.kind', 'subsystem-model'],
          ['model.component_count', '1,482'],
          ['model.edge_count', '2,940'],
        ],
      },
      {
        name: 'rpc.getSubsystemModel',
        process: 'Studio host',
        durationMs: 412,
        attributes: [
          ['rpc.system', 'electrobun'],
          ['rpc.method', 'getSubsystemModel'],
          ['rpc.status', 'ok'],
        ],
      },
      {
        name: 'graph.prepare-and-render',
        process: 'Renderer',
        durationMs: 4780,
        failed: true,
        attributes: [
          ['ui.long_task', 'true'],
          ['ui.blocked_ms', '4,612'],
          ['graph.nodes', '1,482'],
        ],
      },
      {
        name: 'analysis-worker.layout',
        process: 'Analysis worker',
        durationMs: 286,
        attributes: [
          ['worker.queue_wait_ms', '14'],
          ['worker.result', 'ok'],
        ],
      },
    ],
  },
  {
    id: 'timeline-timeout',
    time: '10:31:04',
    title: 'Construct timeline request timed out',
    operation: 'construct-timeline.extend',
    durationMs: 1800,
    summary:
      'The request exceeded its client deadline. Child-process exit and timeout spans would help distinguish the cause.',
    traceId: '5e0c1138…f414',
    spans: [
      {
        name: 'construct-timeline.extend',
        process: 'Renderer',
        durationMs: 1800,
        failed: true,
        attributes: [
          ['studio.tab.kind', 'constructs'],
          ['rpc.method', 'extendConstructTimeline'],
          ['rpc.status', 'deadline_exceeded'],
        ],
      },
      {
        name: 'construct-timeline.worker',
        process: 'Analysis worker',
        durationMs: 1650,
        failed: true,
        attributes: [
          ['worker.queue_wait_ms', '8'],
          ['worker.exit_reason', 'timeout'],
        ],
      },
    ],
  },
  {
    id: 'renderer-pause',
    time: '10:08:51',
    title: 'Renderer unresponsive for 1.1s',
    operation: 'studio.renderer.long_task',
    durationMs: 1100,
    summary:
      'A renderer long task had no matching slow host span, pointing toward UI-side work.',
    traceId: '8f81be32…a06c',
    spans: [
      {
        name: 'studio.renderer.long_task',
        process: 'Renderer',
        durationMs: 1100,
        failed: true,
        attributes: [
          ['ui.long_task', 'true'],
          ['ui.blocked_ms', '1,082'],
          ['studio.tab.kind', 'maintainer'],
        ],
      },
    ],
  },
];

const quietEvent: DemoEvent = {
  id: 'model-list-refresh',
  time: '10:42:18',
  title: 'Model list refreshed in 84ms',
  operation: 'subsystem-models.refresh',
  durationMs: 84,
  summary: 'A normal host request completed without a notable renderer stall.',
  traceId: 'c3d5a55a…20f1',
  spans: [
    {
      name: 'subsystem-models.refresh',
      process: 'Studio host',
      durationMs: 84,
      attributes: [
        ['rpc.method', 'listSubsystemModels'],
        ['rpc.status', 'ok'],
      ],
    },
    {
      name: 'studio.renderer.commit',
      process: 'Renderer',
      durationMs: 22,
      attributes: [
        ['ui.long_task', 'false'],
        ['model.count', '12'],
      ],
    },
  ],
};

const categories: Record<
  Category,
  {
    label: string;
    title: string;
    description: string;
    signal: string;
    stats: Array<{ label: string; value: (quiet: boolean) => string }>;
  }
> = {
  renderer: {
    label: 'Renderer stalls',
    title: 'Renderer responsiveness',
    description:
      'Separate UI-thread work from time spent waiting on the Studio host.',
    signal: 'studio.renderer.long_task · blocked_ms · studio.tab.kind',
    stats: [
      { label: 'Stalls over 500ms', value: (quiet) => (quiet ? '0' : '3') },
      { label: 'Longest pause', value: (quiet) => (quiet ? '—' : '4.8s') },
      {
        label: 'Total blocked time',
        value: (quiet) => (quiet ? '0ms' : '7.2s'),
      },
    ],
  },
  rpc: {
    label: 'RPC latency',
    title: 'Host request latency',
    description:
      'See which RPC methods are slow and compare renderer wait time with host execution time.',
    signal: 'rpc.method · duration_ms · rpc.status · trace_id',
    stats: [
      {
        label: 'p95 round trip',
        value: (quiet) => (quiet ? '126ms' : '1.24s'),
      },
      {
        label: 'Slowest host span',
        value: (quiet) => (quiet ? '84ms' : '412ms'),
      },
      { label: 'Requests', value: (quiet) => (quiet ? '96' : '284') },
    ],
  },
  failures: {
    label: 'Failed operations',
    title: 'Failures and timeouts',
    description:
      'Group errors by operation and inspect the related trace rather than scanning every span.',
    signal: 'rpc.status · exception.type · worker.exit_reason',
    stats: [
      { label: 'Error rate', value: (quiet) => (quiet ? '0.0%' : '2.4%') },
      { label: 'Failed calls', value: (quiet) => (quiet ? '0' : '7') },
      { label: 'Timeouts', value: (quiet) => (quiet ? '0' : '2') },
    ],
  },
  workers: {
    label: 'Worker activity',
    title: 'Analysis workers',
    description:
      'Distinguish jobs queued behind other work from jobs that are slow or exiting unexpectedly.',
    signal: 'worker.name · queue_wait_ms · duration_ms · exit_reason',
    stats: [
      {
        label: 'p95 job duration',
        value: (quiet) => (quiet ? '94ms' : '286ms'),
      },
      { label: 'p95 queue wait', value: (quiet) => (quiet ? '4ms' : '14ms') },
      { label: 'Timed out jobs', value: (quiet) => (quiet ? '0' : '1') },
    ],
  },
};

const categoryIcons = {
  renderer: Activity,
  rpc: Gauge,
  failures: AlertTriangle,
  workers: Cpu,
};

const categoryEvents: Record<Category, DemoEvent[]> = {
  renderer: [freezeEvents[0], freezeEvents[2]],
  rpc: [freezeEvents[0], freezeEvents[1]],
  failures: [freezeEvents[1], freezeEvents[2]],
  workers: [freezeEvents[0], freezeEvents[1]],
};

const chartSamples: Record<Category, number[]> = {
  renderer: [
    7, 8, 10, 9, 8, 12, 10, 8, 13, 9, 16, 10, 9, 42, 10, 8, 11, 10, 8, 38, 12,
    9, 10, 8,
  ],
  rpc: [
    12, 10, 9, 14, 12, 16, 13, 11, 15, 17, 11, 18, 16, 13, 12, 28, 17, 13, 15,
    14, 42, 18, 13, 16,
  ],
  failures: [
    0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  workers: [
    10, 9, 8, 12, 10, 13, 14, 12, 11, 16, 13, 10, 15, 12, 14, 11, 15, 12, 10,
    36, 13, 12, 11, 14,
  ],
};

export interface StudioTelemetryOverviewProps {
  /** Storybook fixtures only; no Maple connection is made. */
  scenario?: Scenario;
}

export const StudioTelemetryOverview: React.FC<
  StudioTelemetryOverviewProps
> = ({ scenario = 'freeze' }) => {
  const { theme } = useTheme();
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(
    null,
  );
  const quiet = scenario === 'quiet';
  const disconnected = scenario === 'disconnected';
  const small = theme.fontSizes[0];
  const body = theme.fontSizes[1];
  const title = theme.fontSizes[6];

  const metricCards: Array<{
    category: Category;
    label: string;
    value: string;
    note: string;
    tone: 'good' | 'warn' | 'bad' | 'neutral';
    icon: React.ReactNode;
  }> = [
    {
      category: 'renderer',
      label: 'Renderer stalls',
      value: quiet ? '0' : '3',
      note: quiet ? 'No tasks over 500ms' : 'Longest pause 4.8s',
      tone: quiet ? 'good' : 'bad',
      icon: <Waves size={17} />,
    },
    {
      category: 'rpc',
      label: 'RPC latency · p95',
      value: quiet ? '126ms' : '1.24s',
      note: quiet ? '96 host requests' : '284 host requests',
      tone: quiet ? 'good' : 'warn',
      icon: <Gauge size={17} />,
    },
    {
      category: 'failures',
      label: 'Failed operations',
      value: quiet ? '0.0%' : '2.4%',
      note: quiet ? '0 failed calls' : '7 failed calls',
      tone: quiet ? 'good' : 'bad',
      icon: <AlertTriangle size={17} />,
    },
    {
      category: 'workers',
      label: 'Worker activity',
      value: quiet ? '94ms' : '286ms',
      note: quiet ? 'No timeouts' : 'p95 job time · 1 timeout',
      tone: quiet ? 'good' : 'warn',
      icon: <Cpu size={17} />,
    },
  ];

  return (
    <main
      style={{
        height: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        boxSizing: 'border-box',
        background: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        padding: '28px clamp(18px, 3vw, 42px) 40px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1440,
          minHeight: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          boxSizing: 'border-box',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 25,
          }}
        >
          <div>
            <div
              style={{
                color: theme.colors.textSecondary,
                fontSize: small,
                marginBottom: 9,
              }}
            >
              Dev Workspace <span aria-hidden="true">/</span> Subsystems Studio
            </div>
            <h1
              style={{
                color: theme.colors.text,
                fontSize: title,
                fontWeight: 700,
                letterSpacing: '-0.04em',
                margin: 0,
              }}
            >
              Studio health
            </h1>
            <p
              style={{
                color: theme.colors.textSecondary,
                fontSize: body,
                margin: '7px 0 0',
              }}
            >
              Investigate pauses across the renderer, host, and workers.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <StatusPill
              theme={theme}
              color={disconnected ? '#f87171' : '#34d399'}
              text={disconnected ? 'Maple unavailable' : 'Maple local · sample'}
            />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid #fbbf244d',
                borderRadius: 999,
                padding: '7px 10px',
                color: '#fbbf24',
                background: '#fbbf2412',
                fontSize: small,
                fontWeight: 650,
              }}
            >
              Storybook mock data
            </span>
          </div>
        </header>

        <section
          aria-label="Studio health metrics"
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
            gap: 12,
          }}
        >
          {metricCards.map((metric) => (
            <MetricCard
              key={metric.category}
              theme={theme}
              category={metric.category}
              selected={expandedCategory === metric.category}
              onClick={() =>
                setExpandedCategory((current) =>
                  current === metric.category ? null : metric.category,
                )
              }
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              note={metric.note}
              tone={metric.tone}
            />
          ))}
        </section>

        {expandedCategory ? (
          <CategoryDetails
            key={expandedCategory}
            category={expandedCategory}
            quiet={quiet}
            theme={theme}
            onClose={() => setExpandedCategory(null)}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '38px 16px',
              color: theme.colors.textSecondary,
              fontSize: body,
            }}
          >
            <ArrowDownRight size={16} />
            Select a metric to see its breakdown and related traces.
          </div>
        )}
      </div>
    </main>
  );
};

function MetricCard({
  theme,
  category,
  selected,
  onClick,
  icon,
  label,
  value,
  note,
  tone,
}: {
  theme: StudioTheme;
  category: Category;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const toneColors = {
    good: '#34d399',
    warn: '#fbbf24',
    bad: '#f87171',
    neutral: theme.colors.textSecondary,
  };
  const color = toneColors[tone];
  const TrendIcon = tone === 'good' ? ArrowDownRight : ArrowUpRight;
  return (
    <button
      type="button"
      aria-expanded={selected}
      aria-controls="studio-telemetry-category-details"
      onClick={onClick}
      style={{
        minWidth: 0,
        width: '100%',
        padding: '17px 18px',
        textAlign: 'left',
        borderRadius: 12,
        border: `1px solid ${selected ? '#a78bfa88' : theme.colors.border}`,
        background: selected ? '#a78bfa12' : theme.colors.backgroundSecondary,
        color: theme.colors.text,
        cursor: 'pointer',
        font: 'inherit',
        boxShadow: selected ? '0 0 0 1px #a78bfa22 inset' : undefined,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span style={{ color, display: 'inline-flex' }}>{icon}</span>
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          marginTop: 12,
        }}
      >
        <strong
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes[6],
            lineHeight: 1.1,
            letterSpacing: '-0.04em',
          }}
        >
          {value}
        </strong>
        <TrendIcon size={14} color={color} />
      </span>
      <span
        style={{
          display: 'block',
          color: selected ? theme.colors.text : theme.colors.textSecondary,
          fontSize: theme.fontSizes[1],
          textAlign: 'center',
          marginTop: 7,
        }}
      >
        {note}
      </span>
      <span
        style={{
          display: 'block',
          height: 0,
          overflow: 'hidden',
          fontSize: 0,
        }}
      >
        {category}
      </span>
    </button>
  );
}

function CategoryDetails({
  category,
  quiet,
  theme,
  onClose,
}: {
  category: Category;
  quiet: boolean;
  theme: StudioTheme;
  onClose: () => void;
}) {
  const config = categories[category];
  const Icon = categoryIcons[category];
  const categoryConfig = categories[category];
  const events = quiet
    ? category === 'failures'
      ? []
      : [quietEvent]
    : categoryEvents[category];
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id);
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const panel: React.CSSProperties = {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 12,
    background: theme.colors.backgroundSecondary,
  };
  const small = theme.fontSizes[0];
  const body = theme.fontSizes[1];
  const heading = theme.fontSizes[2];

  return (
    <section
      id="studio-telemetry-category-details"
      aria-label={`${config.label} expanded metrics`}
      style={{
        ...panel,
        flex: 1,
        marginTop: 16,
        padding: 18,
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 17,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              color: '#a78bfa',
              borderRadius: 9,
              background: '#a78bfa18',
              flexShrink: 0,
            }}
          >
            <Icon size={18} />
          </span>
          <div>
            <h2
              style={{
                color: theme.colors.text,
                fontSize: heading,
                fontWeight: 650,
                margin: 0,
              }}
            >
              {config.title}
            </h2>
            <p
              style={{
                color: theme.colors.textSecondary,
                fontSize: body,
                margin: '5px 0 0',
              }}
            >
              {config.description}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse metric details"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 30,
            height: 30,
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <X size={15} />
        </button>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
          gap: 9,
          marginBottom: 14,
        }}
      >
        {categoryConfig.stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 9,
              padding: '10px 12px',
              background: theme.colors.background,
            }}
          >
            <div style={{ color: theme.colors.textSecondary, fontSize: small }}>
              {stat.label}
            </div>
            <strong
              style={{
                display: 'block',
                color: theme.colors.text,
                fontSize: theme.fontSizes[4],
                marginTop: 4,
              }}
            >
              {stat.value(quiet)}
            </strong>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 410px), 1fr))',
          gap: 12,
        }}
      >
        <div style={{ ...panel, padding: 14, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <strong style={{ color: theme.colors.text, fontSize: body }}>
              {category === 'failures' ? 'Failures over time' : 'Recent trend'}
            </strong>
            <span
              style={{ color: theme.colors.textSecondary, fontSize: small }}
            >
              Past hour
            </span>
          </div>
          <ActivityChart
            values={
              quiet
                ? chartSamples[category].map((_, index) => index % 3)
                : chartSamples[category]
            }
            highlight={
              quiet ? [] : category === 'failures' ? [3, 8, 15] : [13, 19, 20]
            }
            color={
              category === 'failures'
                ? '#f87171'
                : processColors[
                    category === 'renderer'
                      ? 'Renderer'
                      : category === 'workers'
                        ? 'Analysis worker'
                        : 'Studio host'
                  ]
            }
            theme={theme}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: theme.colors.textSecondary,
              fontSize: small,
              marginTop: 7,
            }}
          >
            <span>60 min ago</span>
            <span>30 min</span>
            <span>Now</span>
          </div>
        </div>

        <div style={{ ...panel, padding: 14, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 9,
            }}
          >
            <strong style={{ color: theme.colors.text, fontSize: body }}>
              Related events
            </strong>
            <span
              style={{ color: theme.colors.textSecondary, fontSize: small }}
            >
              {events.length}
            </span>
          </div>
          {events.length ? (
            <div style={{ display: 'grid', gap: 7 }}>
              {events.map((event) => {
                const selected = event.id === selectedEventId;
                const failed = event.spans.some((span) => span.failed);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '9px 10px',
                      textAlign: 'left',
                      color: theme.colors.text,
                      border: `1px solid ${selected ? '#a78bfa77' : theme.colors.border}`,
                      borderRadius: 8,
                      background: selected
                        ? '#a78bfa12'
                        : theme.colors.background,
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: body,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 99,
                            background: failed ? '#f87171' : '#34d399',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {event.title}
                        </span>
                      </span>
                      <span
                        style={{
                          display: 'block',
                          color: theme.colors.textSecondary,
                          fontSize: small,
                          margin: '4px 0 0 15px',
                        }}
                      >
                        {event.time} · {event.operation}
                      </span>
                    </span>
                    <span
                      style={{
                        color: failed ? '#fca5a5' : '#86efac',
                        fontSize: small,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDuration(event.durationMs)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: '18px 8px',
                color: theme.colors.textSecondary,
                fontSize: body,
                textAlign: 'center',
              }}
            >
              No failed events in this sample window.
            </div>
          )}
        </div>
      </div>

      {selectedEvent && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0, 1.2fr) minmax(min(100%, 320px), 1fr)',
            gap: 12,
            marginTop: 12,
          }}
        >
          <div style={{ ...panel, padding: 14, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <strong style={{ color: theme.colors.text, fontSize: body }}>
                Trace spans
              </strong>
              <code
                style={{ color: theme.colors.textSecondary, fontSize: small }}
              >
                {selectedEvent.traceId}
              </code>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {selectedEvent.spans.map((span) => (
                <div
                  key={span.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(112px, 0.75fr) minmax(0, 1.6fr) auto',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 9px',
                    borderRadius: 7,
                    background: theme.colors.background,
                  }}
                >
                  <span
                    style={{
                      color: processColors[span.process],
                      fontSize: small,
                      fontWeight: 650,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {span.process}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      color: span.failed ? '#fca5a5' : theme.colors.text,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: small,
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {span.name}
                  </span>
                  <span style={{ color: theme.colors.text, fontSize: small }}>
                    {formatDuration(span.durationMs)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...panel, padding: 14, minWidth: 0 }}>
            <strong style={{ color: theme.colors.text, fontSize: body }}>
              What this captures
            </strong>
            <p
              style={{
                color: theme.colors.textSecondary,
                fontSize: small,
                lineHeight: 1.5,
                margin: '7px 0 10px',
              }}
            >
              {selectedEvent.summary}
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {(selectedEvent.spans[0]?.attributes ?? []).map(
                ([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: small,
                    }}
                  >
                    <span style={{ color: theme.colors.textSecondary }}>
                      {key}
                    </span>
                    <span style={{ color: theme.colors.text }}>{value}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          marginTop: 13,
          color: theme.colors.textSecondary,
          fontSize: small,
          lineHeight: 1.5,
        }}
      >
        <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
        <span>
          Candidate OTel signals: <code>{config.signal}</code>. These
          Studio-specific spans still need to be instrumented.
        </span>
      </div>
    </section>
  );
}

function ActivityChart({
  values,
  highlight,
  color,
  theme,
}: {
  values: number[];
  highlight: number[];
  color: string;
  theme: StudioTheme;
}) {
  const peak = Math.max(...values, 1);
  const bars = values
    .map((value, index) => {
      const height = Math.max(2, Math.round((value / peak) * 58));
      return `M${index * 12},64v-${height}h9v${height}z`;
    })
    .join(' ');
  const highlights = values
    .map((value, index) => {
      if (!highlight.includes(index)) return '';
      const height = Math.max(2, Math.round((value / peak) * 58));
      return `M${index * 12},64v-${height}h9v${height}z`;
    })
    .join(' ');
  return (
    <svg
      role="img"
      aria-label="Sample metric trend"
      viewBox={`0 0 ${values.length * 12} 64`}
      preserveAspectRatio="none"
      style={{
        display: 'block',
        width: '100%',
        height: 74,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      <title>Sample metric trend</title>
      <path d={bars} fill={color} opacity="0.5" />
      <path d={highlights} fill="#f87171" opacity="0.95" />
    </svg>
  );
}

function StatusPill({
  theme,
  color,
  text,
}: {
  theme: StudioTheme;
  color: string;
  text: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 999,
        padding: '7px 10px',
        color: theme.colors.textSecondary,
        background: theme.colors.backgroundSecondary,
        fontSize: theme.fontSizes[0],
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          background: color,
          boxShadow: `0 0 10px ${color}80`,
        }}
      />
      {text}
    </span>
  );
}

function formatDuration(milliseconds: number) {
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${milliseconds}ms`;
}
