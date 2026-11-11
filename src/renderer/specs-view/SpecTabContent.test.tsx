/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { SpecTabContent } from './SpecTabContent';

// The tab body self-loads through FileSystemService (read + watch). Stories
// mock the same surface; tests stub the module so no IPC is involved.
jest.mock('../main-process-api/FileSystemService', () => ({
  FileSystemService: {
    readFile: jest.fn(),
    watchFile: jest.fn(async () => true),
    stopWatchingFile: jest.fn(async () => true),
    onFileChange: jest.fn(() => () => {}),
  },
}));

// panel-framework-core also ships ESM; only PanelEventBus (the fallback link
// bus) is needed as a value — stub it inert (same as sibling tab tests).
jest.mock('@principal-ade/panel-framework-core', () => ({
  PanelEventBus: class {},
}));

// themed-markdown ships ESM (outside jest's transform allowlist), so component
// tests stub it — the stub renders real `.markdown-slide` headings, which is
// exactly what the requirements rail reads (same approach as
// TopicDescriptionBody.test.tsx).
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
jest.mock('themed-markdown', () => ({
  DocumentView: ({ content }: { content: string }) => {
    const blocks = content
      .split(/\r?\n/)
      .map((line) => {
        const h2 = /^##\s+(.+)$/.exec(line);
        const h3 = /^###\s+(.+)$/.exec(line);
        const h4 = /^####\s+(.+)$/.exec(line);
        if (h2)
          return (
            <h2 key={`h2-${h2[1]}`} id={slug(h2[1])}>
              {h2[1]}
            </h2>
          );
        if (h3)
          return (
            <h3 key={`h3-${h3[1]}`} id={slug(h3[1])}>
              {h3[1]}
            </h3>
          );
        if (h4)
          return (
            <h4 key={`h4-${h4[1]}`} id={slug(h4[1])}>
              {h4[1]}
            </h4>
          );
        return null;
      })
      .filter(Boolean);
    return <div className="markdown-slide">{blocks}</div>;
  },
}));

const readFileMock = FileSystemService.readFile as jest.Mock;

const CAPABILITY_SPEC = `# List Command Specification

## Purpose

The \`openspec list\` command SHALL provide a quick overview.

## Requirements
### Requirement: Command Execution
The command SHALL scan changes or specs.

#### Scenario: Scanning for changes (default)
- **WHEN** \`openspec list\` runs
- **THEN** changes are listed

#### Scenario: Scanning for specs
- **WHEN** \`openspec list --specs\` runs
- **THEN** specs are listed

### Requirement: Error Handling

#### Scenario: Missing directory
- **WHEN** the directory is missing
`;

const CHANGE_DELTA = `## ADDED Requirements
### Requirement: Global Install Scope

#### Scenario: Installing with --global
- **WHEN** a global install runs

## REMOVED Requirements
### Requirement: Per-Project Prompt
`;

function renderTab(filePath: string, repositoryPath?: string) {
  return render(
    <ThemeProvider>
      <SpecTabContent
        filePath={filePath}
        repositoryPath={repositoryPath}
        // No events bus in tests: links degrade, rendering is unaffected.
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  readFileMock.mockReset();
});

describe('SpecTabContent', () => {
  test('shows one selected part at a time and navigates into its scenario', async () => {
    readFileMock.mockResolvedValue({ content: CAPABILITY_SPEC });
    renderTab(
      '/work/OpenSpec/openspec/specs/cli-list/spec.md',
      '/work/OpenSpec',
    );

    // Header: parsed title, badge, breadcrumb, stats.
    expect(
      await screen.findByRole('heading', {
        name: 'List Command Specification',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Capability spec')).toBeTruthy();
    expect(screen.getByText('OpenSpec / cli-list')).toBeTruthy();
    expect(screen.getByText('2 requirements · 3 scenarios')).toBeTruthy();

    // The initial Overview is a single Purpose section, not a long stack of
    // every requirement and scenario.
    expect(
      screen.getByRole('heading', { level: 2, name: 'Purpose' }),
    ).toBeTruthy();
    const content = document.querySelector(
      '.spec-reader-content',
    ) as HTMLElement;
    expect(content.querySelectorAll('.spec-requirement-card')).toHaveLength(0);
    expect(content.querySelectorAll('.spec-scenario-card')).toHaveLength(0);

    const outline = screen.getByLabelText('Spec outline');
    const commandExecution = Array.from(
      outline.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Command Execution'));
    if (!commandExecution) throw new Error('Command Execution link missing');
    fireEvent.click(commandExecution);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Command Execution' }),
    ).toBeTruthy();
    expect(content.querySelectorAll('.spec-scenario-picker')).toHaveLength(2);

    const scanningScenario = Array.from(
      outline.querySelectorAll('button'),
    ).find((button) =>
      button.textContent?.includes('Scanning for changes (default)'),
    );
    if (!scanningScenario) throw new Error('Scenario link missing');
    fireEvent.click(scanningScenario);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Scanning for changes (default)',
      }),
    ).toBeTruthy();
    expect(content.querySelectorAll('.spec-focused-scenario')).toHaveLength(1);
    expect(content.querySelectorAll('.spec-scenario-card')).toHaveLength(1);
  });

  test('renders the reading body with the requirements rail', async () => {
    readFileMock.mockResolvedValue({ content: CAPABILITY_SPEC });
    renderTab('/work/OpenSpec/openspec/specs/cli-list/spec.md');

    await screen.findByRole('heading', { name: 'List Command Specification' });
    // The rail builds a frame after the markdown paints.
    const rail = await waitFor(
      () => {
        const found = screen.getByLabelText('Spec outline');
        expect(found.querySelectorAll('button').length).toBeGreaterThan(0);
        return found;
      },
      { timeout: 3000 },
    );
    // The outline names requirements directly and lists scenarios beneath them.
    expect(railButton(rail, 'Purpose')).toBe(true);
    expect(railButton(rail, 'Command Execution')).toBe(true);
    expect(railButton(rail, 'Error Handling')).toBe(true);
  });

  test('uses Up/Down arrows to focus and select outline parts', async () => {
    readFileMock.mockResolvedValue({ content: CAPABILITY_SPEC });
    renderTab('/work/OpenSpec/openspec/specs/cli-list/spec.md');
    await screen.findByRole('heading', { name: 'List Command Specification' });

    const outline = screen.getByLabelText('Spec outline');
    const buttons = outline.querySelectorAll<HTMLButtonElement>(
      'button[data-spec-nav-item]',
    );
    buttons[0].focus(); // Purpose
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' });

    expect(document.activeElement).toBe(buttons[1]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Requirements' }),
    ).toBeTruthy();

    fireEvent.keyDown(buttons[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[2]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Command Execution' }),
    ).toBeTruthy();

    fireEvent.keyDown(buttons[2], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[1]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Requirements' }),
    ).toBeTruthy();
  });

  test('switches to the original Markdown document', async () => {
    readFileMock.mockResolvedValue({ content: CAPABILITY_SPEC });
    renderTab('/work/OpenSpec/openspec/specs/cli-list/spec.md');

    await screen.findByRole('heading', { name: 'List Command Specification' });
    fireEvent.click(screen.getByRole('tab', { name: 'Markdown' }));

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Requirement: Command Execution',
      }),
    ).toBeTruthy();
    expect(document.querySelectorAll('.spec-requirement-card')).toHaveLength(0);
    expect(
      screen
        .getByRole('tab', { name: 'Markdown' })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  test('renders change delta badges and chips', async () => {
    readFileMock.mockResolvedValue({ content: CHANGE_DELTA });
    renderTab(
      '/work/OpenSpec/openspec/changes/add-global-install-scope/specs/skills-cli/spec.md',
      '/work/OpenSpec',
    );

    // Deltas have no `# ` title — the capability id heads the tab.
    expect(
      await screen.findByRole('heading', { name: 'skills-cli' }),
    ).toBeTruthy();
    expect(screen.getByText('Change delta')).toBeTruthy();
    expect(screen.getByText('ADDED 1')).toBeTruthy();
    expect(screen.getByText('REMOVED 1')).toBeTruthy();
    expect(
      screen.getByText('OpenSpec / add-global-install-scope / skills-cli'),
    ).toBeTruthy();
    expect(screen.getByText('2 requirements · 1 scenario')).toBeTruthy();
  });

  test('shows the error state when the file cannot be read', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT: no such file'));
    renderTab('/work/OpenSpec/openspec/specs/missing/spec.md');

    expect(
      await screen.findByText(/Couldn’t read this spec file/),
    ).toBeTruthy();
    expect(screen.getByText('ENOENT: no such file')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy();
  });

  test('shows the empty state for a blank file', async () => {
    readFileMock.mockResolvedValue({ content: '   \n' });
    renderTab('/work/OpenSpec/openspec/specs/blank/spec.md');

    expect(await screen.findByText('This spec file is empty.')).toBeTruthy();
  });

  test('drops spec badges for markdown outside the openspec layouts', async () => {
    readFileMock.mockResolvedValue({ content: '# Release Notes\n\nProse.\n' });
    renderTab('/work/OpenSpec/docs/release-notes.md', '/work/OpenSpec');

    expect(
      await screen.findByRole('heading', { name: 'Release Notes' }),
    ).toBeTruthy();
    expect(screen.queryByText('Capability spec')).toBeNull();
    expect(screen.queryByText('Change delta')).toBeNull();
    expect(screen.queryByText(/requirements? ·/)).toBeNull();
  });
});

/** Rail buttons concatenate title + scenario count; match on that text. */
function railButton(rail: HTMLElement, expected: string): boolean {
  const normalize = (text: string) => text.replace(/\s+/g, '');
  return Array.from(rail.querySelectorAll('button')).some(
    (button) => normalize(button.textContent ?? '') === normalize(expected),
  );
}
