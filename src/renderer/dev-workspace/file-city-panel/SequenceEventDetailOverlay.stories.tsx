import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';

import type { FileCitySequenceEventDef } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { SequenceEventDetailOverlay } from './SequenceEventDetailOverlay';

type ReadFileResult = { content: string; filePath: string } | null;
type ReadFileOverride =
  | { kind: 'content'; content: string }
  | { kind: 'missing' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

declare global {
  interface Window {
    __SEQUENCE_DETAIL_STORY__?: ReadFileOverride;
  }
}

if (typeof window !== 'undefined' && window.mainProcess?.fileSystem) {
  const fs = window.mainProcess.fileSystem;
  const original = fs.readFile.bind(fs);
  fs.readFile = (filePath: string): Promise<ReadFileResult> => {
    const override = window.__SEQUENCE_DETAIL_STORY__;
    if (!override) return original(filePath);
    switch (override.kind) {
      case 'pending':
        return new Promise<ReadFileResult>(() => {});
      case 'missing':
        return Promise.resolve(null);
      case 'error':
        return Promise.reject(new Error(override.message));
      case 'content':
        return Promise.resolve({ content: override.content, filePath });
    }
  };
}

const SAMPLE_TS = `import { EventEmitter } from 'events';

export interface QueueItem<T> {
  id: string;
  payload: T;
  enqueuedAt: number;
}

export class WorkQueue<T> extends EventEmitter {
  private items: QueueItem<T>[] = [];
  private inFlight = new Set<string>();

  enqueue(payload: T): QueueItem<T> {
    const item: QueueItem<T> = {
      id: cryptoRandomId(),
      payload,
      enqueuedAt: Date.now(),
    };
    this.items.push(item);
    this.emit('enqueued', item);
    return item;
  }

  dequeue(): QueueItem<T> | null {
    const item = this.items.shift() ?? null;
    if (item) {
      this.inFlight.add(item.id);
      this.emit('dequeued', item);
    }
    return item;
  }
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
`;

const LONG_SAMPLE_TS = Array.from({ length: 12 }, (_, i) =>
  [
    `// ----- block ${i + 1} -----`,
    `export function process_${i}(input: number): number {`,
    `  let acc = input;`,
    `  for (let j = 0; j < 8; j++) {`,
    `    acc = (acc * 31 + j) >>> 0;`,
    `  }`,
    `  return acc;`,
    `}`,
    '',
  ].join('\n'),
).join('\n');

const CityBackdrop: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 30% 40%, ${theme.colors.primary}33 0%, transparent 40%),
          radial-gradient(circle at 70% 60%, ${theme.colors.accent ?? theme.colors.primary}22 0%, transparent 45%),
          ${theme.colors.background}
        `,
        display: 'grid',
        placeItems: 'center',
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
      }}
    >
      <span style={{ opacity: 0.5 }}>(file-city canvas would render here)</span>
    </div>
  );
};

interface HarnessProps {
  event: FileCitySequenceEventDef;
  absolutePath: string | null;
  bottomOffset: number | string;
  override: ReadFileOverride;
  withOpenInTab?: boolean;
  /** When provided, ignore `event`/`absolutePath` and walk through this list using the prev/next chevrons. */
  events?: Array<{ event: FileCitySequenceEventDef; absolutePath: string | null }>;
  initialIndex?: number;
}

const Harness: React.FC<HarnessProps> = ({
  event,
  absolutePath,
  bottomOffset,
  override,
  withOpenInTab = true,
  events,
  initialIndex = 0,
}) => {
  window.__SEQUENCE_DETAIL_STORY__ = override;
  React.useEffect(
    () => () => {
      if (window.__SEQUENCE_DETAIL_STORY__ === override) {
        delete window.__SEQUENCE_DETAIL_STORY__;
      }
    },
    [override],
  );

  const [open, setOpen] = React.useState(true);
  const [index, setIndex] = React.useState(initialIndex);

  const useList = events && events.length > 0;
  const currentEvent = useList ? events[index].event : event;
  const currentPath = useList ? events[index].absolutePath : absolutePath;
  const position = useList
    ? { index: index + 1, total: events.length }
    : undefined;
  const onPrev = useList && index > 0 ? () => setIndex((i) => i - 1) : undefined;
  const onNext =
    useList && index < events.length - 1
      ? () => setIndex((i) => i + 1)
      : undefined;

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <CityBackdrop />
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Reopen overlay
        </button>
      )}
      {open && (
        <SequenceEventDetailOverlay
          event={currentEvent}
          absolutePath={currentPath}
          bottomOffset={bottomOffset}
          position={position}
          onPrev={onPrev}
          onNext={onNext}
          onClose={() => setOpen(false)}
          onOpenInTab={
            withOpenInTab
              ? () =>
                  console.info(
                    '[SequenceEventDetailOverlay story] open-in-tab',
                    currentPath,
                  )
              : undefined
          }
        />
      )}
    </div>
  );
};

const meta: Meta<typeof Harness> = {
  title: 'DevWorkspace/FileCityPanel/SequenceEventDetailOverlay',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Harness>;

const baseEvent: FileCitySequenceEventDef = {
  id: 'evt-enqueue',
  name: 'work-queue.enqueue',
  label: 'WorkQueue.enqueue',
  type: 'method',
  participant: 'WorkQueue',
  sourcePath: 'src/WorkQueue.ts',
  snippet: {
    startLine: 14,
    endLine: 21,
    focusLine: 19,
    contextLines: 2,
  },
};

export const WithSnippet: Story = {
  args: {
    event: baseEvent,
    absolutePath: '/mock/repo/src/WorkQueue.ts',
    bottomOffset: 0,
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default: short snippet — overlay collapses to the natural height of header + metadata + snippet rather than stretching full panel height.',
      },
    },
  },
};

export const LongSnippet: Story = {
  args: {
    event: {
      ...baseEvent,
      snippet: { startLine: 1, endLine: 100, focusLine: 50, contextLines: 4 },
    },
    absolutePath: '/mock/repo/src/processors.ts',
    bottomOffset: 0,
    override: { kind: 'content', content: LONG_SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Snippet exceeds the viewport cap (`maxHeight: calc(100% - bottomOffset)`) — body scrolls internally instead of pushing the overlay past the bottom.',
      },
    },
  },
};

export const WithBottomOffset: Story = {
  args: {
    event: baseEvent,
    absolutePath: '/mock/repo/src/WorkQueue.ts',
    bottomOffset: '50%',
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          '`bottomOffset: "50%"` reserves the bottom half of the panel — used in production when the sequence drawer is open.',
      },
    },
  },
};

export const SingleLineSnippet: Story = {
  args: {
    event: {
      ...baseEvent,
      id: 'evt-id',
      label: 'cryptoRandomId()',
      snippet: { startLine: 30, endLine: 30, focusLine: 30, contextLines: 3 },
    },
    absolutePath: '/mock/repo/src/WorkQueue.ts',
    bottomOffset: 0,
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Single-line snippet — header shows "Line N" rather than a range.',
      },
    },
  },
};

export const NoSnippet: Story = {
  args: {
    event: { ...baseEvent, snippet: undefined },
    absolutePath: '/mock/repo/src/WorkQueue.ts',
    bottomOffset: 0,
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Event has a sourcePath but no snippet metadata — body renders the "No snippet attached" placeholder.',
      },
    },
  },
};

export const NoSourcePath: Story = {
  args: {
    event: {
      ...baseEvent,
      sourcePath: undefined,
      snippet: undefined,
    },
    absolutePath: null,
    bottomOffset: 0,
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Event has no source path resolved — body renders the "No source path" placeholder; header has no filename row.',
      },
    },
  },
};

export const WithNavigation: Story = {
  args: {
    bottomOffset: 0,
    override: { kind: 'content', content: SAMPLE_TS },
    initialIndex: 1,
    event: baseEvent, // unused — `events` takes over
    absolutePath: null,
    events: [
      {
        event: {
          id: 'evt-1',
          name: 'work-queue.enqueue',
          label: 'WorkQueue.enqueue',
          type: 'method',
          participant: 'WorkQueue',
          sourcePath: 'src/WorkQueue.ts',
          snippet: { startLine: 14, endLine: 21, focusLine: 19, contextLines: 2 },
        },
        absolutePath: '/mock/repo/src/WorkQueue.ts',
      },
      {
        event: {
          id: 'evt-2',
          name: 'work-queue.dequeue',
          label: 'WorkQueue.dequeue',
          type: 'method',
          participant: 'WorkQueue',
          sourcePath: 'src/WorkQueue.ts',
          snippet: { startLine: 24, endLine: 30, focusLine: 26, contextLines: 2 },
        },
        absolutePath: '/mock/repo/src/WorkQueue.ts',
      },
      {
        event: {
          id: 'evt-3',
          name: 'work-queue.id',
          label: 'cryptoRandomId()',
          type: 'function',
          participant: 'WorkQueue',
          sourcePath: 'src/WorkQueue.ts',
          snippet: { startLine: 33, endLine: 35, focusLine: 34, contextLines: 2 },
        },
        absolutePath: '/mock/repo/src/WorkQueue.ts',
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three-event sequence with prev/next chevrons in the top bar. Use the buttons or `Alt+←` / `Alt+→` to step through; the position pill shows `n / total`. Boundary buttons render disabled.',
      },
    },
  },
};

export const MinimalMetadata: Story = {
  args: {
    event: {
      id: 'evt-bare',
      name: 'bare.event',
      sourcePath: 'src/WorkQueue.ts',
      snippet: { startLine: 14, endLine: 21, focusLine: 19, contextLines: 2 },
    },
    absolutePath: '/mock/repo/src/WorkQueue.ts',
    bottomOffset: 0,
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'No `label` set — the title falls back to the canonical `event.name`.',
      },
    },
  },
};

export const Loading: Story = {
  args: {
    event: baseEvent,
    absolutePath: '/mock/repo/src/WorkQueue.ts',
    bottomOffset: 0,
    override: { kind: 'pending' },
  },
};

export const NotFound: Story = {
  args: {
    event: baseEvent,
    absolutePath: '/mock/repo/missing.ts',
    bottomOffset: 0,
    override: { kind: 'missing' },
  },
};

export const ReadError: Story = {
  args: {
    event: baseEvent,
    absolutePath: '/mock/repo/protected.ts',
    bottomOffset: 0,
    override: { kind: 'error', message: 'EACCES: permission denied' },
  },
};
