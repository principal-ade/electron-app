import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  PanelEventBus,
  type PanelEvent,
} from '@principal-ade/panel-framework-core';
import {
  ProcessesLeftPanel,
  PROCESS_INTENTS,
  type ProcessEntry,
} from './ProcessesLeftPanel';

// ---------------------------------------------------------------------------
// Fixtures
//
// A mix of active processes (dev server, storybook, watcher) and history
// (stopped / failed) to exercise every row state, badge, and action cluster.
// ---------------------------------------------------------------------------

const minutesAgo = (n: number) => Date.now() - n * 60_000;
const hoursAgo = (n: number) => Date.now() - n * 3_600_000;

const entry = (
  over: Partial<ProcessEntry> & Pick<ProcessEntry, 'id' | 'label' | 'command'>,
): ProcessEntry => ({
  cwd: '~/Developer/desktop-app/electron-app',
  kind: 'dev-server',
  status: 'running',
  startedAt: minutesAgo(12),
  runCount: 1,
  ...over,
});

const processFixtures: ProcessEntry[] = [
  entry({
    id: 'p-electron-app',
    label: 'electron-app dev',
    command: 'npm run start:dev',
    cwd: '~/Developer/desktop-app/electron-app',
    kind: 'dev-server',
    status: 'running',
    pid: 48210,
    port: 5173,
    startedAt: minutesAgo(34),
    hasOpenTab: true,
    source: 'topic:portal-unification',
  }),
  entry({
    id: 'p-storybook',
    label: 'Storybook',
    command: 'npm run storybook',
    cwd: '~/Developer/desktop-app/electron-app',
    kind: 'dev-server',
    status: 'running',
    pid: 48333,
    port: 6006,
    startedAt: minutesAgo(9),
  }),
  entry({
    id: 'p-build-watch',
    label: 'tsc --watch',
    command: 'npx tsc -p tsconfig.build.json --watch',
    kind: 'watcher',
    status: 'starting',
    pid: 48401,
    startedAt: minutesAgo(0),
  }),
  entry({
    id: 'p-vitest',
    label: 'vitest watch',
    command: 'npx vitest watch src/renderer',
    kind: 'task',
    status: 'failed',
    pid: undefined,
    startedAt: minutesAgo(52),
    endedAt: minutesAgo(48),
    exitCode: 1,
    lastError: 'Test suite failed to run: Cannot find module "xterm"',
    runCount: 4,
  }),
  entry({
    id: 'p-prev-dev',
    label: 'electron-app dev',
    command: 'npm run start:dev',
    kind: 'dev-server',
    status: 'stopped',
    port: 3000,
    startedAt: hoursAgo(5),
    endedAt: hoursAgo(3),
    exitCode: 0,
    runCount: 3,
    fromHistory: true,
  }),
  entry({
    id: 'p-http-server',
    label: 'static preview',
    command: 'python3 -m http.server 8000',
    kind: 'script',
    status: 'stopped',
    port: 8000,
    startedAt: hoursAgo(26),
    endedAt: hoursAgo(25),
    exitCode: 0,
    fromHistory: true,
  }),
  entry({
    id: 'p-docker',
    label: 'docker compose up',
    command: 'docker compose up api db',
    kind: 'task',
    status: 'failed',
    startedAt: hoursAgo(30),
    endedAt: hoursAgo(30),
    exitCode: 125,
    lastError: 'Cannot connect to the Docker daemon',
    runCount: 2,
    fromHistory: true,
  }),
];

// ---------------------------------------------------------------------------
// Static stories
// ---------------------------------------------------------------------------

const meta: Meta<typeof ProcessesLeftPanel> = {
  title: 'Panels/ProcessesLeftPanel',
  component: ProcessesLeftPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ width: '100vw', height: '100vh' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Running + history, across every status and action cluster. */
export const Default: Story = {
  render: () => (
    <ProcessesLeftPanel
      entries={processFixtures}
      events={new PanelEventBus()}
      activeEntryId="p-electron-app"
    />
  ),
};

/** No processes — the empty prompt. */
export const Empty: Story = {
  render: () => (
    <ProcessesLeftPanel entries={[]} events={new PanelEventBus()} />
  ),
};

/** Fetch in flight — the "Loading…" state. */
export const Loading: Story = {
  render: () => (
    <ProcessesLeftPanel entries={[]} loading events={new PanelEventBus()} />
  ),
};

/** Fetch rejected — the error message. */
export const LoadError: Story = {
  render: () => (
    <ProcessesLeftPanel
      entries={[]}
      error="Could not load processes."
      events={new PanelEventBus()}
    />
  ),
};

/** Only active processes — the "Running" section with no history. */
export const AllRunning: Story = {
  render: () => (
    <ProcessesLeftPanel
      entries={processFixtures.filter((e) =>
        ['running', 'starting', 'restarting', 'stopping'].includes(e.status),
      )}
      events={new PanelEventBus()}
    />
  ),
};

/** Only finished/failed commands — the "History" section on its own. */
export const HistoryOnly: Story = {
  render: () => (
    <ProcessesLeftPanel
      entries={processFixtures.filter((e) =>
        ['stopped', 'failed'].includes(e.status),
      )}
      events={new PanelEventBus()}
    />
  ),
};

/** A long list — scroll behavior + section headers. */
export const Many: Story = {
  render: () => (
    <ProcessesLeftPanel
      entries={[
        ...processFixtures,
        ...processFixtures.map((e) => ({
          ...e,
          id: `${e.id}-b`,
          label: `${e.label} (2)`,
        })),
      ]}
      events={new PanelEventBus()}
    />
  ),
};

// ---------------------------------------------------------------------------
// Interactive — a tiny in-memory registry driven by the intents the panel
// emits. Demonstrates the full interaction contract: open/focus (without
// killing), restart/run-again (history → running), stop/kill (running →
// history), and remove. This is the story to use when deciding what the
// interactions should actually do.
// ---------------------------------------------------------------------------

const InteractiveRegistry: React.FC<{ initial: ProcessEntry[] }> = ({
  initial,
}) => {
  const bus = useMemo(() => new PanelEventBus(), []);
  const [entries, setEntries] = useState<ProcessEntry[]>(initial);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<string>('—');
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const record = (name: string, e: ProcessEntry) => {
      setLastIntent(`${name} → ${e.label}`);
      setLog((prev) => [`${name} → ${e.label}`, ...prev].slice(0, 12));
    };

    const handlers: Array<[string, (e: ProcessEntry) => void]> = [
      [
        PROCESS_INTENTS.open,
        (e) => {
          record('open', e);
          setActiveEntryId(e.id);
          // Opening a tab must NOT kill the process — just mark it as shown.
          setEntries((prev) =>
            prev.map((x) => (x.id === e.id ? { ...x, hasOpenTab: true } : x)),
          );
        },
      ],
      [
        PROCESS_INTENTS.restart,
        (e) => {
          record('restart', e);
          setEntries((prev) =>
            prev.map((x) =>
              x.id === e.id
                ? {
                    ...x,
                    status: 'running',
                    startedAt: Date.now(),
                    endedAt: undefined,
                    exitCode: undefined,
                    lastError: undefined,
                    hasOpenTab: true,
                    fromHistory: false,
                    runCount: (x.runCount ?? 0) + 1,
                  }
                : x,
            ),
          );
        },
      ],
      [
        PROCESS_INTENTS.stop,
        (e) => {
          record('stop', e);
          setEntries((prev) =>
            prev.map((x) =>
              x.id === e.id
                ? { ...x, status: 'stopped', endedAt: Date.now(), exitCode: 0 }
                : x,
            ),
          );
        },
      ],
      [
        PROCESS_INTENTS.kill,
        (e) => {
          record('kill', e);
          setEntries((prev) =>
            prev.map((x) =>
              x.id === e.id
                ? { ...x, status: 'failed', endedAt: Date.now(), exitCode: 137 }
                : x,
            ),
          );
        },
      ],
      [
        PROCESS_INTENTS.remove,
        (e) => {
          record('remove', e);
          setEntries((prev) => prev.filter((x) => x.id !== e.id));
          setActiveEntryId((cur) => (cur === e.id ? null : cur));
        },
      ],
    ];

    const unsubs = handlers.map(([type, fn]) =>
      bus.on(type, (evt: PanelEvent<unknown>) => {
        const payload = evt.payload as { entry: ProcessEntry };
        fn(payload.entry);
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [bus]);

  const runningCount = entries.filter((e) =>
    ['starting', 'running', 'restarting', 'stopping'].includes(e.status),
  ).length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#101014',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid #2a2a33',
          color: '#c8c8d0',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <span>
          running: <b>{runningCount}</b>
        </span>
        <span>
          history: <b>{entries.length - runningCount}</b>
        </span>
        <span style={{ color: '#8a8a99' }}>last: {lastIntent}</span>
        <span
          style={{
            marginLeft: 'auto',
            color: '#6a6a78',
            maxWidth: '40%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={log.join('\n')}
        >
          {log.slice(0, 3).join('  ·  ')}
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ProcessesLeftPanel
          entries={entries}
          events={bus}
          activeEntryId={activeEntryId}
        />
      </div>
    </div>
  );
};

/** Drive the panel: open/restart/stop/kill/remove mutate a live registry. */
export const Interactive: Story = {
  render: () => <InteractiveRegistry initial={processFixtures} />,
};
