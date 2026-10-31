import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgenticResourcesPanel } from './AgenticResourcesPanel';
import { MockPanelProvider } from './mocks/panelContext';
import type { Agent } from './agents/hooks/useAgentsData';
import type { Subagent } from './agents/hooks/useSubagentsData';

const mockAgents: Agent[] = [
  {
    id: 'AGENTS.md',
    name: 'Project Agents',
    path: 'AGENTS.md',
    content: `# Project Setup

Install dependencies:

\`\`\`bash
npm install
\`\`\`

## Build

Run the build:

\`\`\`bash
npm run build
\`\`\`

## Testing

Run tests:

\`\`\`bash
npm test
\`\`\`

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Use Prettier for formatting`,
    source: 'project-root',
    priority: 1,
    sections: {
      setup: 'Install dependencies: npm install',
      build: 'Run the build: npm run build',
      test: 'Run tests: npm test',
      style: 'Use TypeScript strict mode, Follow ESLint rules',
    },
  },
  {
    id: 'packages/web/AGENTS.md',
    name: 'web',
    path: 'packages/web/AGENTS.md',
    content: `# Web Package

This is the web frontend package.

## Setup

Install dependencies and build the UI components.

## Testing

Run Cypress tests for the web interface.`,
    source: 'project-nested',
    priority: 2,
    sections: {
      setup: 'Install dependencies and build the UI components.',
      test: 'Run Cypress tests for the web interface.',
    },
  },
];

const mockSubagents: Subagent[] = [
  {
    id: '.claude/agents/code-reviewer.md',
    name: 'code-reviewer',
    path: '.claude/agents/code-reviewer.md',
    content: `---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide specific, actionable feedback on quality, security, and best practices.`,
    prompt: 'You are a code reviewer. When invoked, analyze the code and provide specific, actionable feedback on quality, security, and best practices.',
    frontmatter: {
      name: 'code-reviewer',
      description: 'Reviews code for quality and best practices',
      tools: 'Read, Glob, Grep',
      model: 'sonnet',
    },
    source: 'project-claude',
    priority: 1,
  },
  {
    id: '.claude/agents/test-writer.md',
    name: 'test-writer',
    path: '.claude/agents/test-writer.md',
    content: `---
name: test-writer
description: Writes comprehensive unit tests for code
tools: Read, Write, Bash
model: haiku
permissionMode: acceptEdits
---

You are a test writing expert. When invoked, write comprehensive unit tests with good coverage and edge cases.`,
    prompt: 'You are a test writing expert. When invoked, write comprehensive unit tests with good coverage and edge cases.',
    frontmatter: {
      name: 'test-writer',
      description: 'Writes comprehensive unit tests for code',
      tools: 'Read, Write, Bash',
      model: 'haiku',
      permissionMode: 'acceptEdits',
    },
    source: 'project-claude',
    priority: 1,
  },
];

// Mock SKILL.md content
const createSkillContent = (
  title: string,
  description: string,
  capabilities: string[]
) => `# ${title}

${description}

## Capabilities

${capabilities.map((cap) => `- ${cap}`).join('\n')}

## Usage

This skill can be used by AI agents to ${description.toLowerCase()}.
`;

const meta: Meta<typeof AgenticResourcesPanel> = {
  title: 'Panels/AgenticResourcesPanel',
  component: AgenticResourcesPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A unified panel for displaying both Agents (AGENTS.md, subagents) and Skills (SKILL.md) with a mode toggle.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: '600px', width: '100%' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgenticResourcesPanel>;

export const Default: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [
            // Agents
            { name: 'AGENTS.md', relativePath: 'AGENTS.md', type: 'file' },
            { name: 'AGENTS.md', relativePath: 'packages/web/AGENTS.md', type: 'file' },
            { name: 'code-reviewer.md', relativePath: '.claude/agents/code-reviewer.md', type: 'file' },
            { name: 'test-writer.md', relativePath: '.claude/agents/test-writer.md', type: 'file' },
            // Skills
            { name: 'SKILL.md', relativePath: '.agent/skills/legal-review/SKILL.md', type: 'file' },
            { name: 'SKILL.md', relativePath: '.agent/skills/data-analysis/SKILL.md', type: 'file' },
          ],
          sha: 'mock-sha',
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async (path: string) => {
            // Handle agents
            if (path.includes('AGENTS.md') && !path.includes('.agent')) {
              const agent = mockAgents.find(a => path.endsWith(a.path));
              return agent?.content || '';
            }
            if (path.includes('code-reviewer.md')) {
              return mockSubagents[0].content;
            }
            if (path.includes('test-writer.md')) {
              return mockSubagents[1].content;
            }
            // Handle skills
            if (path.includes('legal-review/SKILL.md')) {
              return createSkillContent(
                'Legal Review',
                'Review legal documents and contracts for compliance',
                ['Contract analysis', 'Compliance checking', 'Risk assessment']
              );
            }
            if (path.includes('data-analysis/SKILL.md')) {
              return createSkillContent(
                'Data Analysis',
                'Analyze and visualize data sets',
                ['Statistical analysis', 'Data visualization', 'Report generation']
              );
            }
            return '';
          },
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

export const AgentsOnly: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [
            { name: 'AGENTS.md', relativePath: 'AGENTS.md', type: 'file' },
            { name: 'code-reviewer.md', relativePath: '.claude/agents/code-reviewer.md', type: 'file' },
          ],
          sha: 'mock-sha',
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async (path: string) => {
            if (path.includes('AGENTS.md')) {
              return mockAgents[0].content;
            }
            return mockSubagents[0].content;
          },
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

export const SkillsOnly: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [
            { name: 'SKILL.md', relativePath: '.agent/skills/legal-review/SKILL.md', type: 'file' },
            { name: 'SKILL.md', relativePath: '.agent/skills/data-analysis/SKILL.md', type: 'file' },
          ],
          sha: 'mock-sha',
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async (path: string) => {
            if (path.includes('legal-review/SKILL.md')) {
              return createSkillContent(
                'Legal Review',
                'Review legal documents and contracts for compliance',
                ['Contract analysis', 'Compliance checking', 'Risk assessment']
              );
            }
            return createSkillContent(
              'Data Analysis',
              'Analyze and visualize data sets',
              ['Statistical analysis', 'Data visualization', 'Report generation']
            );
          },
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

export const Empty: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [],
          sha: 'mock-sha',
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async () => '',
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

export const Loading: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: null,
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

const manySubagents: Subagent[] = [
  {
    id: '.claude/agents/code-reviewer.md',
    name: 'code-reviewer',
    path: '.claude/agents/code-reviewer.md',
    content: `---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide specific, actionable feedback on quality, security, and best practices.`,
    prompt: 'You are a code reviewer. When invoked, analyze the code and provide specific, actionable feedback on quality, security, and best practices.',
    frontmatter: {
      name: 'code-reviewer',
      description: 'Reviews code for quality and best practices',
      tools: 'Read, Glob, Grep',
      model: 'sonnet',
    },
    source: 'project-claude',
    priority: 1,
  },
  {
    id: '.claude/agents/test-writer.md',
    name: 'test-writer',
    path: '.claude/agents/test-writer.md',
    content: `---
name: test-writer
description: Writes comprehensive unit tests for code
tools: Read, Write, Bash
model: haiku
permissionMode: acceptEdits
---

You are a test writing expert. When invoked, write comprehensive unit tests with good coverage and edge cases.`,
    prompt: 'You are a test writing expert. When invoked, write comprehensive unit tests with good coverage and edge cases.',
    frontmatter: {
      name: 'test-writer',
      description: 'Writes comprehensive unit tests for code',
      tools: 'Read, Write, Bash',
      model: 'haiku',
      permissionMode: 'acceptEdits',
    },
    source: 'project-claude',
    priority: 1,
  },
  {
    id: '.claude/agents/refactor-assistant.md',
    name: 'refactor-assistant',
    path: '.claude/agents/refactor-assistant.md',
    content: `---
name: refactor-assistant
description: Helps refactor code for better maintainability and performance
tools: Read, Write, Glob, Grep, Bash
model: opus
permissionMode: bypassPermissions
---

You are a refactoring expert. Analyze code structure and suggest improvements for maintainability, readability, and performance.`,
    prompt: 'You are a refactoring expert. Analyze code structure and suggest improvements for maintainability, readability, and performance.',
    frontmatter: {
      name: 'refactor-assistant',
      description: 'Helps refactor code for better maintainability and performance',
      tools: 'Read, Write, Glob, Grep, Bash',
      model: 'opus',
      permissionMode: 'bypassPermissions',
    },
    source: 'project-claude',
    priority: 1,
  },
  {
    id: '.claude/agents/doc-generator.md',
    name: 'doc-generator',
    path: '.claude/agents/doc-generator.md',
    content: `---
name: doc-generator
description: Generates documentation from code
tools: Read, Write, Glob
model: haiku
---

You are a documentation expert. Generate clear, comprehensive documentation from source code including JSDoc comments, README files, and API docs.`,
    prompt: 'You are a documentation expert. Generate clear, comprehensive documentation from source code including JSDoc comments, README files, and API docs.',
    frontmatter: {
      name: 'doc-generator',
      description: 'Generates documentation from code',
      tools: 'Read, Write, Glob',
      model: 'haiku',
    },
    source: 'project-claude',
    priority: 1,
  },
  {
    id: '~/.claude/agents/security-auditor.md',
    name: 'security-auditor',
    path: '~/.claude/agents/security-auditor.md',
    content: `---
name: security-auditor
description: Audits code for security vulnerabilities and OWASP compliance
tools: Read, Glob, Grep, WebFetch
model: opus
---

You are a security expert. Analyze code for vulnerabilities, check for OWASP Top 10 issues, and recommend security best practices.`,
    prompt: 'You are a security expert. Analyze code for vulnerabilities, check for OWASP Top 10 issues, and recommend security best practices.',
    frontmatter: {
      name: 'security-auditor',
      description: 'Audits code for security vulnerabilities and OWASP compliance',
      tools: 'Read, Glob, Grep, WebFetch',
      model: 'opus',
    },
    source: 'global-claude',
    priority: 1,
  },
  {
    id: '~/.claude/agents/api-designer.md',
    name: 'api-designer',
    path: '~/.claude/agents/api-designer.md',
    content: `---
name: api-designer
description: Designs RESTful and GraphQL APIs following best practices
tools: Read, Write
model: sonnet
---

You are an API design expert. Help design clean, consistent, and well-documented APIs following REST or GraphQL best practices.`,
    prompt: 'You are an API design expert. Help design clean, consistent, and well-documented APIs following REST or GraphQL best practices.',
    frontmatter: {
      name: 'api-designer',
      description: 'Designs RESTful and GraphQL APIs following best practices',
      tools: 'Read, Write',
      model: 'sonnet',
    },
    source: 'global-claude',
    priority: 1,
  },
  {
    id: '~/.claude/agents/performance-optimizer.md',
    name: 'performance-optimizer',
    path: '~/.claude/agents/performance-optimizer.md',
    content: `---
name: performance-optimizer
description: Analyzes and optimizes application performance
tools: Read, Glob, Grep, Bash
model: sonnet
permissionMode: acceptEdits
---

You are a performance optimization expert. Profile applications, identify bottlenecks, and suggest optimizations for speed and resource usage.`,
    prompt: 'You are a performance optimization expert. Profile applications, identify bottlenecks, and suggest optimizations for speed and resource usage.',
    frontmatter: {
      name: 'performance-optimizer',
      description: 'Analyzes and optimizes application performance',
      tools: 'Read, Glob, Grep, Bash',
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    },
    source: 'global-claude',
    priority: 1,
  },
];

export const MultipleSubagents: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [
            { name: 'AGENTS.md', relativePath: 'AGENTS.md', type: 'file' },
            { name: 'code-reviewer.md', relativePath: '.claude/agents/code-reviewer.md', type: 'file' },
            { name: 'test-writer.md', relativePath: '.claude/agents/test-writer.md', type: 'file' },
            { name: 'refactor-assistant.md', relativePath: '.claude/agents/refactor-assistant.md', type: 'file' },
            { name: 'doc-generator.md', relativePath: '.claude/agents/doc-generator.md', type: 'file' },
            { name: 'security-auditor.md', relativePath: '~/.claude/agents/security-auditor.md', type: 'file' },
            { name: 'api-designer.md', relativePath: '~/.claude/agents/api-designer.md', type: 'file' },
            { name: 'performance-optimizer.md', relativePath: '~/.claude/agents/performance-optimizer.md', type: 'file' },
          ],
          sha: 'mock-sha',
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async (path: string) => {
            if (path.includes('AGENTS.md')) {
              return mockAgents[0].content;
            }
            const subagent = manySubagents.find(s => path.includes(s.name));
            return subagent?.content || '';
          },
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

// Helper to create a full Skill object for global skills
const createGlobalSkill = (
  id: string,
  name: string,
  path: string,
  description: string,
  capabilities: string[],
  source: 'global-claude' | 'global-universal'
) => ({
  id,
  name,
  path,
  description,
  capabilities,
  source,
  content: createSkillContent(name, description, capabilities),
  skillFolderPath: path.replace('/SKILL.md', ''),
  hasScripts: false,
  hasReferences: false,
  hasAssets: false,
  priority: source === 'global-universal' ? 2 : 4,
  frontmatterValidation: { isValid: true, hasStructure: true, missingFields: [] },
});

/**
 * No agents exist - only global skills available.
 * The Agents toggle should be hidden, showing only "Skills" as a title.
 * The Project/Global filter should also be hidden since there are no project skills.
 */
export const GlobalSkillsOnly: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [],
          sha: 'mock-sha',
        },
        globalSkills: {
          skills: [
            createGlobalSkill(
              'global-commit',
              'commit',
              '~/.claude/skills/commit/SKILL.md',
              'Generate conventional commit messages',
              ['Git integration', 'Conventional commits'],
              'global-claude'
            ),
            createGlobalSkill(
              'global-review',
              'review',
              '~/.agent/skills/review/SKILL.md',
              'Review pull requests and provide feedback',
              ['Code review', 'PR comments'],
              'global-universal'
            ),
          ],
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async () => '',
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

/**
 * Only subagents exist (no main AGENTS.md files).
 * The agent filter toggle should be hidden since only one type exists.
 * Should auto-switch to subagents filter.
 */
export const SubagentsOnly: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [
            { name: 'code-reviewer.md', relativePath: '.claude/agents/code-reviewer.md', type: 'file' },
            { name: 'test-writer.md', relativePath: '.claude/agents/test-writer.md', type: 'file' },
          ],
          sha: 'mock-sha',
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async (path: string) => {
            if (path.includes('code-reviewer.md')) {
              return mockSubagents[0].content;
            }
            if (path.includes('test-writer.md')) {
              return mockSubagents[1].content;
            }
            return '';
          },
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

/**
 * Only main agents exist (no subagents).
 * The agent filter toggle should be hidden since only one type exists.
 * Should auto-switch to documentation filter.
 */
export const MainAgentsOnly: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [
            { name: 'AGENTS.md', relativePath: 'AGENTS.md', type: 'file' },
            { name: 'AGENTS.md', relativePath: 'packages/web/AGENTS.md', type: 'file' },
          ],
          sha: 'mock-sha',
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async (path: string) => {
            const agent = mockAgents.find(a => path.endsWith(a.path));
            return agent?.content || '';
          },
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};

/**
 * Both project and global skills exist.
 * The Project/Global filter should be visible.
 */
export const MixedSkills: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [
            { name: 'SKILL.md', relativePath: '.agent/skills/legal-review/SKILL.md', type: 'file' },
          ],
          sha: 'mock-sha',
        },
        globalSkills: {
          skills: [
            createGlobalSkill(
              'global-commit',
              'commit',
              '~/.claude/skills/commit/SKILL.md',
              'Generate conventional commit messages',
              ['Git integration', 'Conventional commits'],
              'global-claude'
            ),
          ],
        },
      }}
      mockAdapters={{
        fileSystem: {
          readFile: async (path: string) => {
            if (path.includes('legal-review/SKILL.md')) {
              return createSkillContent(
                'Legal Review',
                'Review legal documents and contracts for compliance',
                ['Contract analysis', 'Compliance checking', 'Risk assessment']
              );
            }
            return '';
          },
        },
      }}
    >
      {({ context, actions }) => (
        <AgenticResourcesPanel
          context={context}
          actions={actions}
          events={{
            emit: () => {},
            on: () => () => {},
            off: () => {},
          }}
        />
      )}
    </MockPanelProvider>
  ),
};
