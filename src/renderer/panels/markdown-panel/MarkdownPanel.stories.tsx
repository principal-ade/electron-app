import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useMemo } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import {
  PanelEventBus,
  type PanelContextValue,
} from '@principal-ade/panel-framework-core';
import type {
  DocumentNote,
  DocumentNotesFileSummary,
} from '../../../shared/types/document-notes.types';
import { MarkdownPanel } from './MarkdownPanel';

// Mock window.mainProcess.documentNotes so DocumentNotesService.list() doesn't
// crash when the panel mounts. Stories don't exercise persistence; we just
// keep notes in an in-memory map keyed by `${repoPath ?? ''}::${relPath}`.
const noteStore = new Map<string, DocumentNote[]>();
const noteKey = (repo: string | undefined, rel: string) =>
  `${repo ?? ''}::${rel}`;

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  w.mainProcess = {
    ...w.mainProcess,
    fileSystem: {
      ...w.mainProcess?.fileSystem,
      // useFileWatch calls these on mount/unmount. Stories don't exercise
      // file-system change events; just no-op the API surface.
      watchFile: async () => true,
      onFileChange: () => () => {},
      stopWatchingFile: async () => true,
    },
    shell: {
      ...w.mainProcess?.shell,
      // External link clicks route through ShellService.openExternal → here.
      // Log instead of shelling out so the Links story is observable.
      openExternal: async (url: string) => {
        console.info('[MarkdownPanel story] shell.openExternal', url);
        return { success: true };
      },
    },
    documentNotes: {
      list: async (repo: string | undefined, rel: string) =>
        noteStore.get(noteKey(repo, rel)) ?? [],
      listLibrary: async () => [] as DocumentNotesFileSummary[],
      create: async (
        repo: string | undefined,
        rel: string,
        draft: { anchor: DocumentNote['anchor']; body: string },
      ) => {
        const now = new Date().toISOString();
        const note: DocumentNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          anchor: draft.anchor,
          metadata: { body: draft.body, createdAt: now, updatedAt: now },
        };
        const k = noteKey(repo, rel);
        noteStore.set(k, [...(noteStore.get(k) ?? []), note]);
        return note;
      },
      update: async (
        repo: string | undefined,
        rel: string,
        id: string,
        body: string,
      ) => {
        const k = noteKey(repo, rel);
        const list = noteStore.get(k) ?? [];
        const idx = list.findIndex((n) => n.id === id);
        if (idx === -1) return null;
        const updated: DocumentNote = {
          ...list[idx],
          metadata: {
            ...list[idx].metadata,
            body,
            updatedAt: new Date().toISOString(),
          },
        };
        const next = [...list];
        next[idx] = updated;
        noteStore.set(k, next);
        return updated;
      },
      delete: async (repo: string | undefined, rel: string, id: string) => {
        const k = noteKey(repo, rel);
        const list = noteStore.get(k) ?? [];
        const next = list.filter((n) => n.id !== id);
        noteStore.set(k, next);
        return next.length !== list.length;
      },
    },
  };
}

const SAMPLE_MARKDOWN = `# Markdown Panel

A live preview of \`themed-markdown\` rendered inside the panel framework.

## Features

- Headings, lists, and **inline formatting** all render with the active theme.
- Selecting text shows a floating pill — click "Add note" to compose, or "Copy" (or just press Cmd+C) to copy the selection.
- Existing annotations show as highlights with a numbered badge.

> Tip: select a phrase inside a single paragraph to anchor a note. Selections
> that cross paragraph boundaries are rejected — the highlight wrapper can't
> span block-level elements.

### Code

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Checklist

- [x] Render markdown
- [x] Per-document notes
- [ ] Real-time collaboration
`;

const NON_MARKDOWN_CONTENT = 'console.log("not markdown");\n';

// A real `---`-separated slide deck (Marp / reveal.js convention). The panel
// detects the separators and offers a "Slideshow" toggle in the toolbar.
const SAMPLE_SLIDES = `---
title: Quarterly Review
---

# Quarterly Review

A markdown deck rendered as a slideshow.

Use the **Slideshow** toggle in the top-right toolbar.

---

## Highlights

- Shipped the markdown panel
- \`---\` separators split the deck into slides
- The code fence below must NOT split the deck:

\`\`\`md
# not a new slide
---
still the same slide
\`\`\`

---

## Next Quarter

1. Slide search
2. Speaker notes
3. Export to PDF

> Thanks for reading.
`;

const SAMPLE_MARKDOWN_WITH_LINKS = `# Links

The doc lives at \`/mock/mock-repo/docs/getting-started.md\`, so its directory
(\`/mock/mock-repo/docs\`) is the base for relative links.

## External (open in OS browser)

- [Anthropic](https://www.anthropic.com) — \`https:\` → \`ShellService.openExternal\`
- [Email us](mailto:hi@example.com) — \`mailto:\` → \`ShellService.openExternal\`

## In-document anchor (renderer scrolls, handler ignores)

- [Jump to relative links](#relative-resolve-against-the-docs-directory)

## Relative — resolve against the doc's directory

- [Sibling: configuration](./configuration.md) — resolves to \`/mock/mock-repo/docs/configuration.md\`
- [Parent: project README](../README.md) — resolves to \`/mock/mock-repo/README.md\`

## Repo-root-relative — resolve against repositoryPath

- [Architecture doc](/docs/architecture.md) — resolves to \`/mock/mock-repo/docs/architecture.md\`

Clicking a relative/root link emits a \`file:opened\` event (logged in the
overlay below); external links log a \`shell.openExternal\` call to the console.
`;

interface HarnessArgs {
  /** Content the mocked `actions.readFile` returns. */
  content?: string;
  /** Path passed to the panel via `filePath`. */
  filePath?: string;
  /** Repository the file belongs to (drives note-keying). */
  repositoryPath?: string;
  /** Optional artificial delay (ms) for `actions.readFile`. */
  readFileDelayMs?: number;
  /** When set, `readFile` rejects with this error. */
  readFileError?: Error;
  /** When true, no `filePath` is passed (empty-state). */
  noFile?: boolean;
  /** When true, overlay the captured `file:opened` events (Links story). */
  showEventLog?: boolean;
}

const MarkdownPanelHarness: React.FC<HarnessArgs> = ({
  content = SAMPLE_MARKDOWN,
  filePath = '/mock/mock-repo/docs/getting-started.md',
  repositoryPath = '/mock/mock-repo',
  readFileDelayMs = 0,
  readFileError,
  noFile = false,
  showEventLog = false,
}) => {
  const events = useMemo(() => new PanelEventBus(), []);

  // Capture `file:opened` so the Links story shows what relative/root links
  // resolve to — in the real app the host framework turns these into tabs.
  const [opened, setOpened] = React.useState<
    { key: number; filePath: string; repositoryPath?: string }[]
  >([]);
  React.useEffect(() => {
    return events.on('file:opened', (event) => {
      const payload = event.payload as {
        filePath: string;
        repositoryPath?: string;
      };
      setOpened((prev) => [...prev, { key: event.timestamp, ...payload }]);
    });
  }, [events]);

  const context = useMemo<PanelContextValue>(
    () => ({
      currentScope: {
        type: 'repository',
        repository: { path: repositoryPath, name: 'mock-repo' },
      },
      refresh: async () => {},
    }),
    [repositoryPath],
  );

  const actions = useMemo(
    () => ({
      readFile: async (p: string) => {
        if (readFileDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, readFileDelayMs));
        }
        if (readFileError) {
          throw readFileError;
        }
        console.info('[MarkdownPanel story] readFile', p);
        return content;
      },
    }),
    [content, readFileDelayMs, readFileError],
  );

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <MarkdownPanel
        context={context}
        actions={actions}
        events={events}
        filePath={noFile ? null : filePath}
        repositoryPath={repositoryPath}
      />
      {showEventLog && (
        <div
          style={{
            position: 'fixed',
            left: 12,
            bottom: 12,
            maxWidth: 520,
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.8)',
            color: '#e6e6e6',
            font: '12px/1.5 ui-monospace, monospace',
            borderRadius: 6,
            zIndex: 1000,
          }}
        >
          <strong>file:opened events</strong>
          {opened.length === 0 ? (
            <div style={{ opacity: 0.7 }}>
              (click a relative or repo-root link)
            </div>
          ) : (
            opened.map((o) => (
              <div key={o.key}>
                → {o.filePath}
                {o.repositoryPath ? `  [repo: ${o.repositoryPath}]` : ''}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const meta: Meta<typeof MarkdownPanelHarness> = {
  title: 'Panels/MarkdownPanel',
  component: MarkdownPanelHarness,
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
type Story = StoryObj<typeof MarkdownPanelHarness>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Panel reads the file via `actions.readFile`. Select a phrase inside a single paragraph to draft a note, or copy with Cmd+C / the Copy button.',
      },
    },
  },
};

export const Slideshow: Story = {
  args: {
    content: SAMPLE_SLIDES,
    filePath: '/mock/mock-repo/docs/quarterly-review.md',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A `---`-separated deck. The toolbar shows a **Slideshow** toggle (absent for non-slide docs like Default); clicking it swaps `DocumentView` for `SlidePresentation` with prev/next nav and a slide counter. The `---` inside the fenced code block does not create an extra slide.',
      },
    },
  },
};

export const Loading: Story = {
  args: { readFileDelayMs: 4000 },
  parameters: {
    docs: {
      description: {
        story:
          '4-second `readFile` delay surfaces the loading state. The same loading branch appears whenever `filePath` changes to a not-yet-loaded path.',
      },
    },
  },
};

export const ErrorState: Story = {
  args: {
    filePath: '/mock/mock-repo/docs/missing.md',
    readFileError: new Error('ENOENT: no such file or directory'),
  },
};

export const NoFileSelected: Story = {
  args: { noFile: true },
  parameters: {
    docs: {
      description: {
        story: 'Empty state when no `filePath` is provided.',
      },
    },
  },
};

export const Links: Story = {
  args: {
    content: SAMPLE_MARKDOWN_WITH_LINKS,
    filePath: '/mock/mock-repo/docs/getting-started.md',
    repositoryPath: '/mock/mock-repo',
    showEventLog: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Exercises `useMarkdownLinkHandler` wired into the panel. External (`https:`/`mailto:`) links log a `shell.openExternal` call; `#anchors` scroll without firing the handler; relative links resolve against the doc directory and repo-root (`/…`) links against `repositoryPath`, both emitting `file:opened` (shown in the overlay).',
      },
    },
  },
};

export const NonMarkdownFile: Story = {
  args: {
    content: NON_MARKDOWN_CONTENT,
    filePath: '/mock/mock-repo/src/index.ts',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `filePath` does not end in `.md`/`.mdx`/`.markdown`, the panel falls through to the placeholder.',
      },
    },
  },
};
