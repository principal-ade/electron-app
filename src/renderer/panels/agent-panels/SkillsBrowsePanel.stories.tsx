/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { SkillsBrowsePanel } from './SkillsBrowsePanel';
import {
  MockPanelProvider,
  createMockContext,
  createMockActions,
  createMockEvents,
} from './mocks/panelContext';
import type { DataSlice } from './types';

/**
 * SkillsBrowsePanel displays Agent Skills from GitHub repositories.
 * It shows skill metadata, descriptions, and capabilities for remote repositories.
 * Does NOT show global/installed skills - only repository skills.
 */
const meta = {
  title: 'Panels/SkillsBrowsePanel',
  component: SkillsBrowsePanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A panel for browsing Agent Skills from GitHub repositories. Shows skill cards with name, description, capabilities, and path. Does not show global/installed skills.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', background: '#f5f5f5' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    context: createMockContext(),
    actions: createMockActions(),
    events: createMockEvents(),
  },
} satisfies Meta<typeof SkillsBrowsePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock SKILL.md content with frontmatter
const createSkillContentWithFrontmatter = (
  title: string,
  description: string,
  capabilities: string[],
  extraFrontmatter?: Record<string, any>
) => `---
name: ${title}
description: ${description}
${extraFrontmatter ? Object.entries(extraFrontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n') : ''}
---

# ${title}

${description}

## Capabilities

${capabilities.map((cap) => `- ${cap}`).join('\n')}

## Usage

This skill can be used by AI agents to ${description.toLowerCase()}.
`;

// Create mock file tree for a GitHub repository
const builder = new PathsFileTreeBuilder();
const mockGitHubRepoTree = builder.build({
  files: [
    '.agent/skills/legal-review/SKILL.md',
    '.agent/skills/legal-review/references/contract-templates.md',
    '.agent/skills/data-analysis/SKILL.md',
    '.agent/skills/data-analysis/scripts/analyze.py',
    '.agent/skills/presentation-maker/SKILL.md',
    '.agent/skills/code-reviewer/SKILL.md',
    'src/index.ts',
    'README.md',
  ],
  rootPath: 'skills-org/professional-skills', // GitHub repo path format
});

// Mock file system adapter for GitHub repository
const createGitHubFileSystemAdapter = () => {
  const skillContents: Record<string, string> = {
    '.agent/skills/legal-review/SKILL.md': createSkillContentWithFrontmatter(
      'Legal Review',
      'Review contracts and legal documents for potential issues and compliance',
      [
        'Identify contractual obligations and liabilities',
        'Check for regulatory compliance',
        'Flag ambiguous or problematic clauses',
      ],
      { tags: ['legal', 'compliance'] }
    ),
    '.agent/skills/data-analysis/SKILL.md': createSkillContentWithFrontmatter(
      'Data Analysis',
      'Analyze datasets to extract insights and generate visualizations',
      [
        'Statistical analysis and trend identification',
        'Data cleaning and preprocessing',
        'Generate charts and visualizations',
      ],
      { tags: ['data', 'analytics'] }
    ),
    '.agent/skills/presentation-maker/SKILL.md': createSkillContentWithFrontmatter(
      'Presentation Maker',
      'Create professional presentations from content and data',
      [
        'Design slide layouts and themes',
        'Convert data into visual stories',
        'Generate speaker notes',
      ],
      { tags: ['presentation', 'design'] }
    ),
    '.agent/skills/code-reviewer/SKILL.md': createSkillContentWithFrontmatter(
      'Code Reviewer',
      'Review code for quality, security, and best practices',
      [
        'Identify potential bugs and security vulnerabilities',
        'Suggest performance improvements',
        'Check adherence to coding standards',
      ],
      { tags: ['code-quality', 'security'] }
    ),
  };

  return {
    readFile: async (path: string) => {
      if (skillContents[path]) {
        return skillContents[path];
      }
      throw new Error(`File not found: ${path}`);
    },
  };
};

/**
 * Default state - browsing a GitHub repository with skills
 */
export const Default: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockGitHubRepoTree,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'repository',
            repository: {
              name: 'professional-skills',
              path: 'skills-org/professional-skills', // GitHub path format
            },
          },
          slices: mockSlices,
          adapters: {
            fileSystem: createGitHubFileSystemAdapter(),
          },
        } as any}
      >
        {(props) => <SkillsBrowsePanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * No skills found in GitHub repository
 */
export const NoSkills: Story = {
  render: () => {
    const noSkillsTree = builder.build({
      files: ['src/index.ts', 'README.md', 'package.json'],
      rootPath: 'example-org/no-skills-repo',
    });

    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: noSkillsTree,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'repository',
            repository: {
              name: 'no-skills-repo',
              path: 'example-org/no-skills-repo',
            },
          },
          slices: mockSlices,
          adapters: {
            fileSystem: createGitHubFileSystemAdapter(),
          },
        } as any}
      >
        {(props) => <SkillsBrowsePanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * Loading state - fetching GitHub repository
 */
export const Loading: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: null,
      loading: true,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'repository',
            repository: {
              name: 'professional-skills',
              path: 'skills-org/professional-skills',
            },
          },
          slices: mockSlices,
          adapters: {
            fileSystem: {
              readFile: async () => {
                // Simulate slow loading
                await new Promise((resolve) => setTimeout(resolve, 10000));
                return '';
              },
            },
          },
        } as any}
      >
        {(props) => <SkillsBrowsePanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * Many skills in GitHub repository (stress test)
 */
export const ManySkills: Story = {
  render: () => {
    // Generate a large file tree with many skills
    const manySkillsPaths = Array.from(
      { length: 30 },
      (_, i) => `.agent/skills/skill-${i + 1}/SKILL.md`
    );
    const manySkillsTree = builder.build({
      files: [...manySkillsPaths, 'src/index.ts', 'README.md'],
      rootPath: 'skills-org/skill-collection',
    });

    const manySkillsAdapter = {
      readFile: async (path: string) => {
        const match = path.match(/skill-(\d+)\/SKILL\.md$/);
        if (match) {
          const num = match[1];
          return createSkillContentWithFrontmatter(
            `Skill ${num}`,
            `This is a skill for testing purposes. Skill number ${num} demonstrates various capabilities.`,
            [
              `Primary capability for skill ${num}`,
              `Secondary capability for skill ${num}`,
              `Advanced feature for skill ${num}`,
            ],
            { tags: [`skill-${num}`, 'test'] }
          );
        }
        throw new Error(`File not found: ${path}`);
      },
    };

    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: manySkillsTree,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'repository',
            repository: {
              name: 'skill-collection',
              path: 'skills-org/skill-collection',
            },
          },
          slices: mockSlices,
          adapters: {
            fileSystem: manySkillsAdapter,
          },
        } as any}
      >
        {(props) => <SkillsBrowsePanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * No repository loaded
 */
export const NoRepository: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: null,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'workspace',
            workspace: {
              name: 'my-workspace',
              path: '/Users/developer/my-workspace',
            },
          },
          slices: mockSlices,
        }}
      >
        {(props) => <SkillsBrowsePanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * With search filtering
 */
export const WithSearch: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockGitHubRepoTree,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'repository',
            repository: {
              name: 'professional-skills',
              path: 'skills-org/professional-skills',
            },
          },
          slices: mockSlices,
          adapters: {
            fileSystem: createGitHubFileSystemAdapter(),
          },
        } as any}
      >
        {(props) => <SkillsBrowsePanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * With refresh button enabled
 * Shows the refresh button when host supports refresh events
 */
export const WithRefresh: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockGitHubRepoTree,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'repository',
            repository: {
              name: 'professional-skills',
              path: 'skills-org/professional-skills',
            },
          },
          slices: mockSlices,
          adapters: {
            fileSystem: createGitHubFileSystemAdapter(),
          },
        } as any}
      >
        {(props) => <SkillsBrowsePanel {...props} supportsRefresh={true} />}
      </MockPanelProvider>
    );
  },
};
