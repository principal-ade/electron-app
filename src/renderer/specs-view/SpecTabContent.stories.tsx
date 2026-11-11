import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useMemo } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { SpecTabContent } from './SpecTabContent';

// Mock the main-process fileSystem surface the tab body touches: readFile
// (content per story), the watch trio from useFileWatch, and shell.openExternal
// for external links. In-app, SpecTabContent reads real files via
// FileSystemService.readFile — stories inject the spec markdown instead.
interface HarnessArgs {
  /** Content the mocked `FileSystemService.readFile` returns. */
  content?: string;
  /** Path passed to the tab (an `openspec/...` path makes it a spec tab). */
  filePath?: string;
  /** Repository the spec belongs to (breadcrumb + link resolution). */
  repositoryPath?: string;
  /** Optional artificial delay (ms) for `readFile`. */
  readFileDelayMs?: number;
  /** When set, `readFile` rejects with this error. */
  readFileError?: Error;
  /** When true, overlay the captured `file:opened` events. */
  showEventLog?: boolean;
}

const SAMPLE_CAPABILITY_SPEC = `# List Command Specification

## Purpose

The \`openspec list\` command SHALL provide developers with a quick overview of all active changes in the project, showing their names and task completion status.

## Requirements
### Requirement: Command Execution
The command SHALL scan and analyze either active changes or specs based on the selected mode.

#### Scenario: Scanning for changes (default)
- **WHEN** \`openspec list\` is executed without flags
- **THEN** scan the \`openspec/changes/\` directory for change directories
- **AND** exclude the \`archive/\` subdirectory from results
- **AND** parse each change's \`tasks.md\` file to count task completion

#### Scenario: Scanning for specs
- **WHEN** \`openspec list --specs\` is executed
- **THEN** scan the \`openspec/specs/\` directory for capabilities
- **AND** read each capability's \`spec.md\`
- **AND** parse requirements to compute requirement counts

### Requirement: Task Counting

The command SHALL accurately count task completion status using standard markdown checkbox patterns.

#### Scenario: Counting tasks in tasks.md

- **WHEN** parsing a \`tasks.md\` file
- **THEN** count tasks matching these patterns:
  - Completed: Lines containing \`- [x]\`
  - Incomplete: Lines containing \`- [ ]\`

### Requirement: Output Format
The command SHALL display items in a clear, readable table format with mode-appropriate progress or counts.

#### Scenario: Displaying change list (default)
- **WHEN** displaying the list of changes
- **THEN** show a table with columns:
  - Change name (directory name)
  - Task progress (e.g., "3/5 tasks" or "✓ Complete")

### Requirement: Error Handling

The command SHALL gracefully handle missing files and directories with appropriate messages.

#### Scenario: Missing changes directory

- **WHEN** \`openspec/changes/\` directory doesn't exist
- **THEN** display error: "No OpenSpec changes directory found. Run 'openspec init' first."

## Why

Developers need a quick way to:
- See what changes are in progress
- Identify which changes are ready to archive

This command provides that visibility with minimal effort.
`;

// Change delta — same grammar, but each section is a delta verb and the file
// usually has no `# ` title.
const SAMPLE_CHANGE_DELTA = `## ADDED Requirements
### Requirement: Global Install Scope

The CLI SHALL support installing skills into a global scope shared across projects.

#### Scenario: Installing with --global

- **WHEN** \`openspec skill install --global <skill>\` is executed
- **THEN** install the skill into the user-level directory
- **AND** make it available to every project on the machine

## MODIFIED Requirements
### Requirement: Install Destination Resolution

The CLI SHALL resolve the install destination from flags and configuration.

#### Scenario: Explicit scope wins

- **WHEN** a scope flag is provided
- **THEN** use that scope regardless of configuration defaults

#### Scenario: Default remains project-local

- **WHEN** no flag and no configuration is present
- **THEN** install into the current project

## REMOVED Requirements
### Requirement: Per-Project Prompt

The CLI SHALL NOT prompt for an install destination per invocation.

## RENAMED Requirements
- FROM: \`global-install-flag\`
- TO: \`global-install-scope\`
`;

// A markdown file that doesn't follow the OpenSpec grammar — the tab still
// renders it (rail follows whatever headings exist).
const SAMPLE_NON_SPEC_MARKDOWN = `# Release Notes

Ordinary markdown opened in a spec tab (e.g. a hand-routed path). It renders
fine — the header just drops the spec badges.

## Highlights

- **Dark mode** — everything is themed.
- Links: [relative doc](./tasks.md) emits \`file:opened\` (see the overlay), while
  [external](https://github.com/Fission-AI/OpenSpec) opens the OS browser.

### Notes

Plain prose still gets outline entries.
`;

const SpecTabHarness: React.FC<HarnessArgs> = ({
  content = SAMPLE_CAPABILITY_SPEC,
  filePath = '/mock/OpenSpec/openspec/specs/cli-list/spec.md',
  repositoryPath = '/mock/OpenSpec',
  readFileDelayMs = 0,
  readFileError,
  showEventLog = false,
}) => {
  const events = useMemo(() => new PanelEventBus(), []);

  // Capture `file:opened` so the link story shows what relative links resolve
  // to — in the real app the shell's handler opens the matching tab.
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

  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.mainProcess = {
      ...w.mainProcess,
      fileSystem: {
        ...w.mainProcess?.fileSystem,
        readFile: async (p: string) => {
          if (readFileDelayMs > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, readFileDelayMs),
            );
          }
          if (readFileError) throw readFileError;
          console.info('[SpecTab story] readFile', p);
          return { content, filePath: p };
        },
        // useFileWatch calls these on mount/unmount; stories don't exercise
        // file-system change events.
        watchFile: async () => true,
        onFileChange: () => () => {},
        stopWatchingFile: async () => true,
      },
      shell: {
        ...w.mainProcess?.shell,
        // External link clicks route through ShellService.openExternal → here.
        openExternal: async (url: string) => {
          console.info('[SpecTab story] shell.openExternal', url);
          return { success: true };
        },
      },
    };
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <SpecTabContent
        filePath={filePath}
        repositoryPath={repositoryPath}
        events={events}
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
              (click a relative link in the body)
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

const meta: Meta<typeof SpecTabHarness> = {
  title: 'Panels/SpecTabContent',
  component: SpecTabHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A structured reader for OpenSpec-style specs (`openspec/specs/<capability>/spec.md` or `openspec/changes/<change>/specs/<capability>/spec.md`). Overview groups requirements into cards, nests each scenario, and color-codes change deltas; the Markdown tab preserves the original document. The left rail follows the current view.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SpecTabHarness>;

export const CapabilitySpec: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A stable capability spec (`openspec/specs/cli-list/spec.md`). Click a rail entry to scroll; the active row follows the reader. The rail’s pills count scenarios per requirement.',
      },
    },
  },
};

export const ChangeDelta: Story = {
  args: {
    content: SAMPLE_CHANGE_DELTA,
    filePath:
      '/mock/OpenSpec/openspec/changes/add-global-install-scope/specs/skills-cli/spec.md',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A change delta (`openspec/changes/<change>/specs/<capability>/spec.md`). Header shows a "Change delta" badge plus ADDED / MODIFIED / REMOVED chips with counts; change deltas usually omit the `# ` title, so the capability id heads the tab.',
      },
    },
  },
};

export const NonSpecMarkdown: Story = {
  args: {
    content: SAMPLE_NON_SPEC_MARKDOWN,
    filePath: '/mock/OpenSpec/docs/release-notes.md',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Graceful fallback: markdown without the OpenSpec grammar still renders (e.g. a hand-routed path); the header just drops the spec badges and stats keep whatever the headings say.',
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
          '4-second `readFile` delay surfaces the loading state. The same branch appears whenever `filePath` changes to a not-yet-loaded path (the tab body remounts per file).',
      },
    },
  },
};

export const ErrorState: Story = {
  args: {
    filePath: '/mock/OpenSpec/openspec/specs/missing/spec.md',
    readFileError: new Error('ENOENT: no such file or directory'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Read failure surfaces the error with a retry button.',
      },
    },
  },
};

export const Links: Story = {
  args: {
    content: SAMPLE_NON_SPEC_MARKDOWN,
    filePath: '/mock/OpenSpec/docs/release-notes.md',
    showEventLog: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Relative links resolve against the spec’s directory and emit `file:opened` (overlay); external links log a `shell.openExternal` call to the console. In-app, spec links opened this way route back into a spec tab.',
      },
    },
  },
};
