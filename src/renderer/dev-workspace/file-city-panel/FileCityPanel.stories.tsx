import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useMemo } from 'react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';
import {
  PanelEventBus,
  type DataSlice,
  type PanelContextValue,
} from '@principal-ade/panel-framework-core';
import {
  PathsFileTreeBuilder,
  type FileTree as RepoFileTree,
} from '@principal-ai/repository-abstraction';

import type {
  SequenceDiagramPayload,
  FileCitySequenceEventDef,
} from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { FileCityPanel } from './FileCityPanel';

const REPO_ROOT = 'mock-repo';
const REPO_PATH = '/mock/mock-repo';

const SAMPLE_PATHS: string[] = [
  `${REPO_ROOT}/package.json`,
  `${REPO_ROOT}/README.md`,
  `${REPO_ROOT}/tsconfig.json`,
  `${REPO_ROOT}/src/index.ts`,
  `${REPO_ROOT}/src/App.tsx`,
  `${REPO_ROOT}/src/components/Button.tsx`,
  `${REPO_ROOT}/src/components/Button.test.tsx`,
  `${REPO_ROOT}/src/components/Modal.tsx`,
  `${REPO_ROOT}/src/components/index.ts`,
  `${REPO_ROOT}/src/hooks/useAuth.ts`,
  `${REPO_ROOT}/src/hooks/useTheme.ts`,
  `${REPO_ROOT}/src/utils/format.ts`,
  `${REPO_ROOT}/src/utils/parse.ts`,
  `${REPO_ROOT}/src/utils/parse.test.ts`,
  `${REPO_ROOT}/src/styles/globals.css`,
  `${REPO_ROOT}/docs/getting-started.md`,
  `${REPO_ROOT}/docs/api/overview.md`,
  `${REPO_ROOT}/docs/api/types.md`,
];

function createMockFileTree(paths: string[] = SAMPLE_PATHS): RepoFileTree {
  const builder = new PathsFileTreeBuilder();
  const built = builder.build({ files: paths, rootPath: REPO_ROOT });
  return {
    ...built,
    metadata: {
      ...built.metadata,
      id: REPO_ROOT,
    },
  };
}

// ---------------------------------------------------------------------------
// File contents — keyed by repo-relative path. The readFile override below
// resolves both relative and absolute (`/mock/mock-repo/...`) lookups.
// ---------------------------------------------------------------------------
const FILE_CONTENTS: Record<string, string> = {
  'src/hooks/useAuth.ts': `import { useCallback, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('login failed');
    const next = (await res.json()) as User;
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  return { user, login, logout };
}

export interface User {
  id: string;
  email: string;
}
`,
  'src/utils/format.ts': `export function formatBytes(bytes: number): string {
  if (bytes < 1024) return \`\${bytes} B\`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return \`\${value.toFixed(1)} \${units[i]}\`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return \`\${ms} ms\`;
  if (ms < 60_000) return \`\${(ms / 1000).toFixed(1)} s\`;
  return \`\${(ms / 60_000).toFixed(1)} min\`;
}
`,
  'src/components/Modal.tsx': `import React from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div role="dialog" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
`,
  'src/components/Button.tsx': `import React from 'react';

export interface ButtonProps {
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({
  onClick,
  variant = 'primary',
  children,
}: ButtonProps) {
  return (
    <button data-variant={variant} onClick={onClick}>
      {children}
    </button>
  );
}
`,
};

function lookupContent(filePath: string): string | null {
  const stripped = filePath.startsWith(`${REPO_PATH}/`)
    ? filePath.slice(REPO_PATH.length + 1)
    : filePath;
  return FILE_CONTENTS[stripped] ?? null;
}

// ---------------------------------------------------------------------------
// Mock window.mainProcess.fileCitySequence + per-file readFile override.
// Set up once at module load so the hooks find an API to subscribe to.
// ---------------------------------------------------------------------------
type SetCb = (p: SequenceDiagramPayload) => void;
type ClearedCb = (info: { repositoryPath?: string }) => void;

const sequenceMock = {
  current: null as SequenceDiagramPayload | null,
  setListeners: new Set<SetCb>(),
  clearedListeners: new Set<ClearedCb>(),
};

function pushSequence(payload: SequenceDiagramPayload) {
  sequenceMock.current = payload;
  sequenceMock.setListeners.forEach((cb) => cb(payload));
}

function clearSequence(repositoryPath?: string) {
  sequenceMock.current = null;
  sequenceMock.clearedListeners.forEach((cb) => cb({ repositoryPath }));
}

if (typeof window !== 'undefined' && window.mainProcess) {
  if (!window.mainProcess.fileCitySequence) {
    (window.mainProcess as unknown as Record<string, unknown>).fileCitySequence =
      {
        getCurrent: async () => sequenceMock.current,
        onPayloadSet: (cb: SetCb) => {
          sequenceMock.setListeners.add(cb);
          return () => sequenceMock.setListeners.delete(cb);
        },
        onPayloadCleared: (cb: ClearedCb) => {
          sequenceMock.clearedListeners.add(cb);
          return () => sequenceMock.clearedListeners.delete(cb);
        },
      };
  }

  if (window.mainProcess.fileSystem) {
    const fs = window.mainProcess.fileSystem;
    const original = fs.readFile.bind(fs);
    fs.readFile = (filePath: string) => {
      const content = lookupContent(filePath);
      if (content != null) return Promise.resolve({ content, filePath });
      return original(filePath);
    };
  }
}

// ---------------------------------------------------------------------------
// Sample sequence payloads exercising different snippet shapes.
// ---------------------------------------------------------------------------
const LOGIN_FLOW: SequenceDiagramPayload = {
  title: 'Login flow',
  repositoryPath: REPO_PATH,
  events: [
    {
      id: 'evt-login',
      name: 'auth.login.start',
      label: 'useAuth.login()',
      type: 'method',
      participant: 'auth',
      sourcePath: 'src/hooks/useAuth.ts',
      snippet: { startLine: 6, endLine: 14, focusLine: 7, contextLines: 2 },
    },
    {
      id: 'evt-format',
      name: 'utils.format.bytes',
      label: 'formatBytes()',
      type: 'function',
      participant: 'utils',
      sourcePath: 'src/utils/format.ts',
      snippet: { startLine: 1, endLine: 11, focusLine: 4, contextLines: 1 },
    },
    {
      id: 'evt-modal',
      name: 'ui.modal.open',
      label: 'Modal',
      type: 'component',
      participant: 'ui',
      sourcePath: 'src/components/Modal.tsx',
      snippet: { startLine: 9, endLine: 17, focusLine: 12, contextLines: 2 },
    } satisfies FileCitySequenceEventDef,
  ],
  edges: [
    { id: 'e1', fromEvent: 'evt-login', toEvent: 'evt-format' },
    { id: 'e2', fromEvent: 'evt-format', toEvent: 'evt-modal' },
  ],
};

// ---------------------------------------------------------------------------
// Change-set walkthrough — diff-snippet variant. Each event represents a
// region the reviewer should look at; oldContents on the event is the
// pre-change file, newContents is the post-change one (matches FILE_CONTENTS
// so the city + the inline diff stay consistent).
// ---------------------------------------------------------------------------
const OLD_USE_AUTH = `import { useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);

  function login(email, password) {
    return fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((res) => res.json());
  }

  function logout() {
    setUser(null);
  }

  return { user, login, logout };
}
`;

const OLD_FORMAT = `export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

export function formatDuration(ms) {
  return ms + 'ms';
}
`;

const OLD_MODAL = `import React from 'react';

export function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div role="dialog">
      {children}
    </div>
  );
}
`;

const REVIEW_WALKTHROUGH: SequenceDiagramPayload = {
  title: 'PR #482 — typed auth + format upgrades',
  repositoryPath: REPO_PATH,
  events: [
    {
      id: 'rev-1',
      name: 'review.useAuth.types',
      label: 'useAuth — typed login + error handling',
      type: 'change',
      participant: 'auth',
      sourcePath: 'src/hooks/useAuth.ts',
      description: `## Typed login + error handling

Adds an explicit \`User\` interface and migrates \`login\` from a \`.then()\` chain to \`async/await\`.

### Why
The previous implementation **silently swallowed non-2xx responses** — callers got a resolved promise with whatever JSON the server returned, including error envelopes. We now throw on \`!res.ok\`, which lets the caller's \`try/catch\` fall through naturally.

### What to look for
- The new \`useCallback\` wrapper — stable reference for downstream effects.
- \`setUser(next)\` so successful logins also update local state.
- Strict \`User | null\` typing on \`useState\`.

### Risk
Low — only call sites that relied on getting an error envelope back as data will need an update. Grep confirmed there are none.`,
      snippet: {
        kind: 'diff',
        oldContents: OLD_USE_AUTH,
        diffStyle: 'unified',
      },
    },
    {
      id: 'rev-2',
      name: 'review.format.bytes',
      label: 'formatBytes — multi-unit scaling',
      type: 'change',
      participant: 'utils',
      sourcePath: 'src/utils/format.ts',
      description: `## Multi-unit byte scaling

Generalises \`formatBytes\` to scale through **KB → MB → GB → TB** instead of stopping at KB, and adds \`number\`/\`string\` types.

### Why
The size column in the file-tree was rendering large repos as e.g. \`1894323.4 KB\`. The unit loop matches the convention used elsewhere in the workspace.

### Edge cases
- The \`while\` guards on \`i < units.length - 1\` so we don't run off the end for petabyte-scale inputs.
- Sub-KB values still get the bare \`B\` suffix.`,
      snippet: {
        kind: 'diff',
        oldContents: OLD_FORMAT,
        diffStyle: 'unified',
      },
    },
    {
      id: 'rev-3',
      name: 'review.modal.click-isolation',
      label: 'Modal — outside-click closes, inside-click stops',
      type: 'change',
      participant: 'ui',
      sourcePath: 'src/components/Modal.tsx',
      description: `## Outside-click closes, inside-click stops

Wires the backdrop \`onClick\` to \`onClose\` and adds \`stopPropagation\` on the inner content so clicks on the modal body don't dismiss it.

### Why
The modal previously rendered **without any click-to-dismiss affordance** — keyboard \`Esc\` worked, but clicking outside did nothing, which was confusing for first-time users.

### Also new
- Typed \`ModalProps\` interface (before this PR the component took untyped \`props\`).
- Explicit \`role="dialog"\` on the inner container.`,
      snippet: {
        kind: 'diff',
        oldContents: OLD_MODAL,
        diffStyle: 'unified',
      },
    },
  ],
  edges: [
    { id: 'r-e1', fromEvent: 'rev-1', toEvent: 'rev-2' },
    { id: 'r-e2', fromEvent: 'rev-2', toEvent: 'rev-3' },
  ],
};

const SHORT_FLOW: SequenceDiagramPayload = {
  title: 'Button click',
  repositoryPath: REPO_PATH,
  events: [
    {
      id: 'evt-button',
      name: 'ui.button.click',
      label: 'Button.onClick',
      type: 'handler',
      participant: 'ui',
      sourcePath: 'src/components/Button.tsx',
      snippet: { startLine: 9, endLine: 16, focusLine: 13, contextLines: 2 },
    },
  ],
  edges: [],
};

interface MockContext extends PanelContextValue {
  fileTree: DataSlice<RepoFileTree | null>;
  repository: { path: string; name: string };
}

interface HarnessProps {
  paths?: string[];
  /** Push this payload immediately on mount (after a tick to let the city build). */
  initialSequence?: SequenceDiagramPayload | null;
  /** Show a control panel for pushing/clearing sequence payloads at runtime. */
  showSequenceControls?: boolean;
}

const FileCityPanelHarness: React.FC<HarnessProps> = ({
  paths,
  initialSequence,
  showSequenceControls = false,
}) => {
  const events = useMemo(() => new PanelEventBus(), []);
  const fileTree = useMemo(
    () =>
      paths === undefined
        ? createMockFileTree()
        : paths.length === 0
          ? null
          : createMockFileTree(paths),
    [paths],
  );

  const context = useMemo<MockContext>(
    () => ({
      currentScope: {
        type: 'repository' as const,
        repository: { path: REPO_PATH, name: REPO_ROOT },
      },
      repository: { path: REPO_PATH, name: REPO_ROOT },
      fileTree: {
        scope: 'repository',
        name: 'fileTree',
        data: fileTree,
        loading: false,
        error: null,
        refresh: async () => {},
      },
      refresh: async () => {},
    }),
    [fileTree],
  );

  React.useEffect(() => {
    const unsubscribe = events.on('file:open', (event) => {
      console.info('[FileCityPanel story] file:open', event.payload);
    });
    return unsubscribe;
  }, [events]);

  React.useEffect(() => {
    if (!initialSequence) return;
    // Defer one tick so the panel has subscribed to onPayloadSet before push.
    const t = setTimeout(() => pushSequence(initialSequence), 0);
    return () => {
      clearTimeout(t);
      clearSequence(REPO_PATH);
    };
  }, [initialSequence]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        display: 'flex',
      }}
    >
      <FileCityPanel context={context} actions={{}} events={events} />
      {showSequenceControls && <SequenceControls />}
    </div>
  );
};

const SequenceControls: React.FC = () => {
  const { theme } = useTheme();
  const buttonStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[0],
    color: theme.colors.text,
    background: theme.colors.backgroundSecondary ?? theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 6,
    cursor: 'pointer',
  };
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        background: `color-mix(in srgb, ${theme.colors.background} 92%, transparent)`,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 8,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <span
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        Sequence
      </span>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => pushSequence(LOGIN_FLOW)}
      >
        Push login flow (3 events)
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => pushSequence(SHORT_FLOW)}
      >
        Push button click (1 event)
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => pushSequence(REVIEW_WALKTHROUGH)}
      >
        Push review walkthrough (3 diffs)
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => clearSequence(REPO_PATH)}
      >
        Clear
      </button>
    </div>
  );
};

const meta: Meta<typeof FileCityPanelHarness> = {
  title: 'DevWorkspace/FileCityPanel',
  component: FileCityPanelHarness,
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
type Story = StoryObj<typeof FileCityPanelHarness>;

export const Default: Story = {};

export const Empty: Story = {
  args: { paths: [] },
  parameters: {
    docs: {
      description: { story: 'Renders the empty-state when no fileTree slice data is available.' },
    },
  },
};

export const Deep: Story = {
  args: {
    paths: [
      ...SAMPLE_PATHS,
      `${REPO_ROOT}/src/components/forms/inputs/TextField.tsx`,
      `${REPO_ROOT}/src/components/forms/inputs/Select.tsx`,
      `${REPO_ROOT}/src/components/forms/inputs/Checkbox.tsx`,
      `${REPO_ROOT}/src/components/forms/layout/Form.tsx`,
      `${REPO_ROOT}/src/components/forms/layout/FieldGroup.tsx`,
      `${REPO_ROOT}/src/components/forms/validation/rules.ts`,
      `${REPO_ROOT}/src/components/forms/validation/messages.ts`,
    ],
  },
};

export const WithSequenceDiagram: Story = {
  args: {
    initialSequence: LOGIN_FLOW,
    showSequenceControls: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pushes a 3-event login flow on mount. Click any node in the sequence drawer to select it — the snippet detail overlay opens on the right with a leader line to the matching building in the city. Use the Sequence control panel (top-left) to swap payloads or clear.',
      },
    },
  },
};

export const ReviewWalkthrough: Story = {
  args: {
    initialSequence: REVIEW_WALKTHROUGH,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pushes a 3-event PR walkthrough on mount. Each event uses the diff snippet variant — the harness ships pre-change `oldContents` inline, and the renderer reads the post-change content from `sourcePath` (mocked via `FILE_CONTENTS`). Click a node, or use the prev/next chevrons under the snippet, to step through the change set; the left explainer + right diff + leader line update together.',
      },
    },
  },
};

export const SequenceWorkshop: Story = {
  args: {
    showSequenceControls: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty panel — use the Sequence control panel (top-left) to push payloads on demand. Useful for testing payload transitions and the leader-line target updates.',
      },
    },
  },
};
