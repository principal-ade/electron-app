import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useEffect, useRef, useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { HookCoverageBoard } from './HookCoverageBoard';
import { HOOK_EVENT_CATALOG } from './hookEventCatalog';
import type { HookDebugEvent } from '../../../shared/ipc-events/HookDebugEvents';

/**
 * Mock-stream helpers. Every story feeds the board a plain array of
 * `HookDebugEvent`s — the same shape the real panel collects off
 * HOOK_DEBUG_CHANNEL — so no live agent is required.
 */

let seq = 0;
const makeEvent = (
  hookEventName: string,
  receivedAt: number,
  extra: Record<string, unknown> = {},
): HookDebugEvent => ({
  provider: 'claude-hook',
  receivedAt,
  raw: {
    hook_event_name: hookEventName,
    session_id: `sess-${(seq % 2) + 1}`,
    ...extra,
  },
});

const TOOLS = ['Bash', 'Read', 'Edit', 'Grep', 'Write', 'WebFetch'];

/** A plausible single-agent run that exercises ~18 of the 30 events. */
const REALISTIC_RUN: string[] = [
  'SessionStart',
  'Setup',
  'InstructionsLoaded',
  'UserPromptSubmit',
  'UserPromptExpansion',
  'PreToolUse',
  'PostToolUse',
  'PreToolUse',
  'PostToolUse',
  'PreToolUse',
  'PostToolBatch',
  'PermissionRequest',
  'PermissionDenied',
  'MessageDisplay',
  'SubagentStart',
  'PreToolUse',
  'PostToolUseFailure',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'Notification',
  'Stop',
  'SessionEnd',
];

const buildEvents = (names: string[], startMs: number): HookDebugEvent[] => {
  seq = 0;
  return names.map((name, i) => {
    seq += 1;
    const isTool = name.startsWith('PreToolUse') || name.startsWith('PostTool');
    return makeEvent(
      name,
      startMs + i * 400,
      isTool ? { tool_name: TOOLS[i % TOOLS.length] } : {},
    );
  });
};

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <div style={{ height: '760px', width: '760px', background: '#0e0e0e' }}>
      {children}
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof HookCoverageBoard> = {
  title: 'Alexandria/HookCoverageBoard',
  component: HookCoverageBoard,
};
export default meta;

type Story = StoryObj<typeof HookCoverageBoard>;

/** Nothing observed yet — all 30 tiles greyed, 0/30. */
export const Empty: Story = {
  render: () => (
    <Frame>
      <HookCoverageBoard events={[]} />
    </Frame>
  ),
};

/** The pre-audit reality: only the original 10 registered events ever fired. */
export const PreAuditTen: Story = {
  render: () => {
    const TEN = [
      'PreToolUse',
      'PermissionRequest',
      'PostToolUse',
      'Notification',
      'UserPromptSubmit',
      'Stop',
      'SubagentStop',
      'PreCompact',
      'SessionStart',
      'SessionEnd',
    ];
    return (
      <Frame>
        <HookCoverageBoard events={buildEvents(TEN, 1_700_000_000_000)} />
      </Frame>
    );
  },
};

/** A realistic post-audit run — the five NEW events light up alongside the rest. */
export const RealisticRun: Story = {
  render: () => (
    <Frame>
      <HookCoverageBoard events={buildEvents(REALISTIC_RUN, 1_700_000_000_000)} />
    </Frame>
  ),
};

/** Every documented event observed at least once — 30/30. */
export const FullCoverage: Story = {
  render: () => (
    <Frame>
      <HookCoverageBoard
        events={buildEvents(
          HOOK_EVENT_CATALOG.map((s) => s.name),
          1_700_000_000_000,
        )}
      />
    </Frame>
  ),
};

/**
 * Live fill-in: replays the realistic run on a timer so you can watch tiles
 * light up and glow as events "arrive" — the audit win, animated.
 */
const LiveStreamHarness: React.FC = () => {
  const [events, setEvents] = useState<HookDebugEvent[]>([]);
  const idx = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (idx.current >= REALISTIC_RUN.length) {
        idx.current = 0;
        setEvents([]);
        return;
      }
      const name = REALISTIC_RUN[idx.current];
      idx.current += 1;
      const isTool = name.startsWith('PreToolUse') || name.startsWith('PostTool');
      setEvents((prev) => [
        makeEvent(
          name,
          Date.now(),
          isTool ? { tool_name: TOOLS[prev.length % TOOLS.length] } : {},
        ),
        ...prev,
      ]);
    }, 700);
    return () => clearInterval(id);
  }, []);

  return <HookCoverageBoard events={events} />;
};

export const LiveStream: Story = {
  render: () => (
    <Frame>
      <LiveStreamHarness />
    </Frame>
  ),
};
