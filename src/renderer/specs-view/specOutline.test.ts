import {
  extractPurposeExcerpt,
  parseSpecDocument,
  parseSpecMarkdown,
} from './specOutline';

const CAPABILITY_SPEC = `# List Command Specification

## Purpose

The \`openspec list\` command SHALL provide developers
with a quick overview of all active changes.

## Requirements
### Requirement: Command Execution
The command SHALL scan and analyze either active changes or specs.

#### Scenario: Scanning for changes (default)
- **WHEN** \`openspec list\` is executed
- **THEN** scan the \`openspec/changes/\` directory

#### Scenario: Scanning for specs
- **WHEN** \`openspec list --specs\` is executed
- **THEN** scan the \`openspec/specs/\` directory

### Requirement: Task Counting

The command SHALL accurately count task completion.

#### Scenario: Counting tasks in tasks.md
- **WHEN** parsing a \`tasks.md\` file

## Why

Developers need a quick way to see progress.

\`\`\`md
## Purpose
#### this heading is inside a fence and must be ignored
\`\`\`
`;

const CHANGE_DELTA = `## ADDED Requirements
### Requirement: Global Install Scope

#### Scenario: Installing with --global
- **WHEN** a global install runs

## MODIFIED Requirements
### Requirement: Install Destination Resolution

## REMOVED Requirements
### Requirement: Per-Project Prompt

## RENAMED Requirements
- FROM: \`global-install-flag\`
- TO: \`global-install-scope\`
`;

describe('parseSpecMarkdown', () => {
  test('parses title, sections, requirements, and scenarios', () => {
    const outline = parseSpecMarkdown(CAPABILITY_SPEC);
    expect(outline.title).toBe('List Command Specification');
    expect(outline.requirementCount).toBe(2);
    expect(outline.scenarioCount).toBe(3);
    expect(outline.hasDeltaSections).toBe(false);

    const labels = outline.sections.map((s) => s.label);
    expect(labels).toEqual(['Purpose', 'Requirements', 'Why']);

    const requirements = outline.sections[1].requirements;
    expect(requirements[0]).toEqual({
      title: 'Command Execution',
      scenarioTitles: ['Scanning for changes (default)', 'Scanning for specs'],
    });
    // Scenario-less requirements still parse with an empty list.
    expect(requirements[1]).toEqual({
      title: 'Task Counting',
      scenarioTitles: ['Counting tasks in tasks.md'],
    });
  });

  test('strips the Requirement: prefix but keeps raw titles otherwise', () => {
    const outline = parseSpecMarkdown('## Requirements\n### Just a heading\n');
    expect(outline.sections[0].requirements[0].title).toBe('Just a heading');
  });

  test('parses change delta sections with counts', () => {
    const outline = parseSpecMarkdown(CHANGE_DELTA);
    expect(outline.title).toBeUndefined(); // deltas usually omit the h1
    expect(outline.hasDeltaSections).toBe(true);
    expect(outline.requirementCount).toBe(3); // ADDED + MODIFIED + REMOVED
    expect(outline.scenarioCount).toBe(1);

    const kinds = outline.sections.map((s) => s.kind);
    expect(kinds).toEqual([
      'delta-ADDED',
      'delta-MODIFIED',
      'delta-REMOVED',
      'delta-RENAMED',
    ]);
    // RENAMED carries no `### Requirement:` headings — just FROM/TO prose.
    expect(outline.sections[3].requirements).toEqual([]);
  });

  test('ignores heading-like lines inside fenced code blocks', () => {
    const outline = parseSpecMarkdown(CAPABILITY_SPEC);
    const allLabels = outline.sections.map((s) => s.label);
    expect(allLabels).not.toContain('this heading is inside a fence');
  });

  test('never throws on non-spec markdown', () => {
    const outline = parseSpecMarkdown('# Notes\n\nJust prose.\n');
    expect(outline.title).toBe('Notes');
    expect(outline.requirementCount).toBe(0);
    expect(outline.sections).toEqual([]);
  });
});

describe('parseSpecDocument', () => {
  test('keeps purpose, requirement descriptions, and scenario bodies separate', () => {
    const document = parseSpecDocument(CAPABILITY_SPEC);
    expect(document.title).toBe('List Command Specification');
    expect(document.sections[0]).toMatchObject({
      label: 'Purpose',
      body: 'The `openspec list` command SHALL provide developers\nwith a quick overview of all active changes.',
      requirements: [],
    });
    expect(document.sections[1].requirements[0]).toMatchObject({
      title: 'Command Execution',
      description:
        'The command SHALL scan and analyze either active changes or specs.',
      scenarios: [
        {
          title: 'Scanning for changes (default)',
          body: '- **WHEN** `openspec list` is executed\n- **THEN** scan the `openspec/changes/` directory',
        },
        {
          title: 'Scanning for specs',
          body: '- **WHEN** `openspec list --specs` is executed\n- **THEN** scan the `openspec/specs/` directory',
        },
      ],
    });
  });

  test('preserves delta section kinds and ignores headings in fenced examples', () => {
    const document = parseSpecDocument(CHANGE_DELTA);
    expect(document.sections.map((section) => section.kind)).toEqual([
      'delta-ADDED',
      'delta-MODIFIED',
      'delta-REMOVED',
      'delta-RENAMED',
    ]);

    const withFence = parseSpecDocument(
      '## Purpose\n\n```md\n### Requirement: Example\n```\n\nActual purpose.\n',
    );
    expect(withFence.sections[0].requirements).toEqual([]);
    expect(withFence.sections[0].body).toContain('### Requirement: Example');
  });
});

describe('extractPurposeExcerpt', () => {
  test('returns the first Purpose paragraph, whitespace-normalized', () => {
    expect(extractPurposeExcerpt(CAPABILITY_SPEC)).toBe(
      'The `openspec list` command SHALL provide developers with a quick overview of all active changes.',
    );
  });

  test('truncates long excerpts with an ellipsis', () => {
    const long = `## Purpose\n\n${'word '.repeat(80)}\n\n## Requirements\n`;
    const excerpt = extractPurposeExcerpt(long, 40);
    expect(excerpt?.endsWith('…')).toBe(true);
    expect(excerpt?.length).toBeLessThanOrEqual(40);
  });

  test('returns undefined when there is no Purpose section', () => {
    expect(extractPurposeExcerpt('# Notes\n\nJust prose.\n')).toBeUndefined();
    expect(extractPurposeExcerpt(CHANGE_DELTA)).toBeUndefined();
  });

  test('ignores fenced code inside the Purpose section', () => {
    const content =
      '## Purpose\n\n```md\n## not purpose\n```\n\nReal purpose.\n';
    expect(extractPurposeExcerpt(content)).toBe('Real purpose.');
  });
});
