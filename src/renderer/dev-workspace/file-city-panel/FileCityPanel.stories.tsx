import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useMemo } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
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
  SequenceNote,
  SequenceNoteDraft,
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

let mockNoteCounter = 0;
function mockCreateNote(
  payloadId: string,
  draft: SequenceNoteDraft,
): SequenceNote {
  if (!sequenceMock.current || sequenceMock.current.id !== payloadId) {
    throw new Error(`mock: payload ${payloadId} not active`);
  }
  const now = new Date().toISOString();
  const note: SequenceNote = {
    ...draft,
    id: `mock-note-${++mockNoteCounter}`,
    createdAt: now,
    updatedAt: now,
  };
  sequenceMock.current = {
    ...sequenceMock.current,
    notes: [...(sequenceMock.current.notes ?? []), note],
  };
  sequenceMock.setListeners.forEach((cb) => cb(sequenceMock.current!));
  return note;
}
function mockDeleteNote(payloadId: string, noteId: string): void {
  if (!sequenceMock.current || sequenceMock.current.id !== payloadId) return;
  sequenceMock.current = {
    ...sequenceMock.current,
    notes: (sequenceMock.current.notes ?? []).filter((n) => n.id !== noteId),
  };
  sequenceMock.setListeners.forEach((cb) => cb(sequenceMock.current!));
}
function mockUpdateNote(
  payloadId: string,
  noteId: string,
  body: string,
): SequenceNote | null {
  if (!sequenceMock.current || sequenceMock.current.id !== payloadId) return null;
  let edited: SequenceNote | null = null;
  sequenceMock.current = {
    ...sequenceMock.current,
    notes: (sequenceMock.current.notes ?? []).map((n) => {
      if (n.id !== noteId) return n;
      edited = { ...n, body, updatedAt: new Date().toISOString() };
      return edited;
    }),
  };
  sequenceMock.setListeners.forEach((cb) => cb(sequenceMock.current!));
  return edited;
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
        createNote: async (payloadId: string, draft: SequenceNoteDraft) =>
          mockCreateNote(payloadId, draft),
        updateNote: async (
          payloadId: string,
          noteId: string,
          body: string,
        ) => mockUpdateNote(payloadId, noteId, body),
        deleteNote: async (payloadId: string, noteId: string) => {
          mockDeleteNote(payloadId, noteId);
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
  id: 'story-login-flow',
  title: 'Login flow',
  repositoryPath: REPO_PATH,
  summary: `A 3-step trace of what happens when a user submits the login form: the auth hook posts credentials, a utility formats the response payload size for the success toast, and the success modal mounts.

### How to read this
- Click any event in the sequence drawer to open its snippet.
- The matching building lights up in the city, with a leader line connecting the two.
- Pick any event for a deeper-dive description; this overview returns when nothing is selected.`,
  notes: [
    {
      id: 'story-note-1',
      kind: 'snippet',
      scope: { eventId: 'evt-login' },
      anchor: {
        kind: 'slice',
        ranges: [
          {
            startLine: 7,
            endLine: 7,
            startLineText: "    return fetch('/api/login', {",
            endLineText: "    return fetch('/api/login', {",
          },
        ],
      },
      body: 'Should we await this fetch instead of using `.then()`? Throwing on `!res.ok` would let callers catch errors with try/catch — see PR #482 for the eventual rewrite.',
      author: 'Fernando',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: 'story-note-2',
      kind: 'snippet',
      scope: { eventId: 'evt-login' },
      anchor: {
        kind: 'slice',
        ranges: [
          {
            startLine: 7,
            endLine: 7,
            startLineText: "    return fetch('/api/login', {",
            endLineText: "    return fetch('/api/login', {",
          },
        ],
      },
      body: 'Agreed. Worth doing here too so the runtime trace matches the typed version.',
      author: 'Reviewer',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'story-md-note-1',
      kind: 'markdown',
      scope: { kind: 'summary' },
      anchor: {
        kind: 'text-quote',
        exact: 'the success modal mounts',
        prefix: 'for the success toast, and ',
        suffix: '.',
      },
      body: "Worth calling out that the modal mount happens on the *resolved* value of the login promise — failures should bypass it. We don't yet handle that in the runtime trace.",
      author: 'Fernando',
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
  ],
  events: [
    {
      id: 'evt-login',
      name: 'auth.login.start',
      label: 'useAuth.login()',
      type: 'method',
      participant: 'auth',
      sourcePath: 'src/hooks/useAuth.ts',
      description: `Entry point for the login flow. Posts \`{ email, password }\` to \`/api/login\` and resolves with the parsed JSON.

### Notes
- This is the **runtime** trace, not the typed/error-handled version from PR #482.
- On success, the resolved value is forwarded to the success toast (next step), then to the modal mount (final step).`,
      snippet: { startLine: 6, endLine: 14, focusLine: 7, contextLines: 2 },
    },
    {
      id: 'evt-format',
      name: 'utils.format.bytes',
      label: 'formatBytes()',
      type: 'function',
      participant: 'utils',
      sourcePath: 'src/utils/format.ts',
      description: `Formats the response payload size for the success toast. Currently bottoms out at KB — the multi-unit upgrade lives in \`REVIEW_WALKTHROUGH\`.`,
      snippet: { startLine: 1, endLine: 11, focusLine: 4, contextLines: 1 },
    },
    {
      id: 'evt-modal',
      name: 'ui.modal.open',
      label: 'Modal',
      type: 'component',
      participant: 'ui',
      sourcePath: 'src/components/Modal.tsx',
      description: `Final step — the success modal renders once \`login()\` resolves. The body is unstyled scaffolding here; outside-click dismissal is added in PR #482.`,
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
  id: 'story-review-walkthrough',
  title: 'PR #482 — typed auth + format upgrades',
  repositoryPath: REPO_PATH,
  summary: `A 3-stop walkthrough of a small PR that tightens types and fixes two longstanding UX papercuts.

### Stops
1. **\`useAuth\`** — typed login + error handling.
2. **\`formatBytes\`** — multi-unit scaling so large repos stop rendering as \`1894323.4 KB\`.
3. **\`<Modal />\`** — outside-click closes, inside-click stops.

### How to read this
- Click any node, or use the chevrons under the snippet, to step through the diff stops.
- Each stop replaces this overview with a per-stop explainer; clear the selection to come back here.

### Risk
Low overall — see each stop's "Risk" section for specifics.`,
  events: [
    {
      id: 'rev-1',
      name: 'review.useAuth.types',
      label: 'useAuth — typed login + error handling',
      type: 'change',
      participant: 'auth',
      sourcePath: 'src/hooks/useAuth.ts',
      description: `Adds an explicit \`User\` interface and migrates \`login\` from a \`.then()\` chain to \`async/await\`.

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
      description: `Generalises \`formatBytes\` to scale through **KB → MB → GB → TB** instead of stopping at KB, and adds \`number\`/\`string\` types.

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
      description: `Wires the backdrop \`onClick\` to \`onClose\` and adds \`stopPropagation\` on the inner content so clicks on the modal body don't dismiss it.

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

interface MockContext extends PanelContextValue {
  fileTree: DataSlice<RepoFileTree | null>;
  repository: { path: string; name: string };
}

interface HarnessProps {
  paths?: string[];
  /** Push this payload immediately on mount (after a tick to let the city build). */
  initialSequence?: SequenceDiagramPayload | null;
}

const FileCityPanelHarness: React.FC<HarnessProps> = ({
  paths,
  initialSequence,
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
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pushes a 3-event login flow on mount. Click any node in the sequence drawer to select it — the snippet detail overlay opens on the right with a leader line to the matching building in the city.',
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
    initialSequence: LOGIN_FLOW,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Iteration workbench for the sequence overlay UI — pushes the login flow on mount and leaves the panel ready for tweaking the diagram, snippet drawer, leader line, and (eventually) notes/feedback affordances.',
      },
    },
  },
};
