import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgentDetailPanel } from './AgentDetailPanel';
import { MockPanelProvider } from './mocks/panelContext';
import type { PanelEventEmitter } from './types';
import type { Agent } from './agents/hooks/useAgentsData';
import type { Subagent } from './agents/hooks/useSubagentsData';

const mockAgent: Agent = {
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

Run tests with good coverage:

\`\`\`bash
npm test
\`\`\`

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Use Prettier for formatting
- Write meaningful commit messages`,
  source: 'project-root',
  priority: 1,
  sections: {
    setup: 'Install dependencies: npm install',
    build: 'Run the build: npm run build',
    test: 'Run tests: npm test',
    style: 'Use TypeScript strict mode',
  },
};

const mockSubagent: Subagent = {
  id: '.claude/agents/code-reviewer.md',
  name: 'code-reviewer',
  path: '.claude/agents/code-reviewer.md',
  content: `---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
permissionMode: default
---

You are a code reviewer with expertise in:

1. **Code Quality**: Check for readability, maintainability, and adherence to best practices
2. **Security**: Identify potential security vulnerabilities
3. **Performance**: Suggest optimizations where applicable
4. **Testing**: Ensure adequate test coverage

When reviewing code:
- Be specific and actionable
- Explain the reasoning behind suggestions
- Prioritize critical issues
- Acknowledge good practices`,
  prompt: `You are a code reviewer with expertise in:

1. **Code Quality**: Check for readability, maintainability, and adherence to best practices
2. **Security**: Identify potential security vulnerabilities
3. **Performance**: Suggest optimizations where applicable
4. **Testing**: Ensure adequate test coverage

When reviewing code:
- Be specific and actionable
- Explain the reasoning behind suggestions
- Prioritize critical issues
- Acknowledge good practices`,
  frontmatter: {
    name: 'code-reviewer',
    description: 'Reviews code for quality and best practices',
    tools: 'Read, Glob, Grep',
    model: 'sonnet',
    permissionMode: 'default',
  },
  source: 'project-claude',
  priority: 1,
};

const meta: Meta<typeof AgentDetailPanel> = {
  title: 'Panels/AgentDetailPanel',
  component: AgentDetailPanel,
  parameters: {
    layout: 'fullscreen',
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
type Story = StoryObj<typeof AgentDetailPanel>;

export const AgentSelected: Story = {
  render: () => {
    const mockEvents = {
      emit: () => {},
      on: (eventType: string, handler: (event: unknown) => void) => {
        if (eventType === 'agent:selected') {
          // Simulate agent selection after mount
          setTimeout(() => {
            handler({
              type: 'agent:selected',
              source: 'agents-list-panel',
              timestamp: Date.now(),
              payload: {
                id: mockAgent.id,
                type: 'agent',
                data: mockAgent,
              },
            });
          }, 100);
        }
        return () => {};
      },
      off: () => {},
    };

    return (
      <MockPanelProvider
        mockSlices={{
          fileTree: {
            allFiles: [
              { name: 'AGENTS.md', relativePath: 'AGENTS.md', type: 'file' },
            ],
            sha: 'mock-sha',
          },
        }}
        mockAdapters={{
          fileSystem: {
            readFile: async () => mockAgent.content,
          },
        }}
      >
        {({ context, actions }) => (
          <AgentDetailPanel
            context={context}
            actions={actions}
            events={mockEvents as unknown as PanelEventEmitter}
          />
        )}
      </MockPanelProvider>
    );
  },
};

export const SubagentSelected: Story = {
  render: () => {
    const mockEvents = {
      emit: () => {},
      on: (eventType: string, handler: (event: unknown) => void) => {
        if (eventType === 'subagent:selected') {
          // Simulate subagent selection after mount
          setTimeout(() => {
            handler({
              type: 'subagent:selected',
              source: 'agents-list-panel',
              timestamp: Date.now(),
              payload: {
                id: mockSubagent.id,
                type: 'subagent',
                data: mockSubagent,
              },
            });
          }, 100);
        }
        return () => {};
      },
      off: () => {},
    };

    return (
      <MockPanelProvider
        mockSlices={{
          fileTree: {
            allFiles: [
              { name: 'code-reviewer.md', relativePath: '.claude/agents/code-reviewer.md', type: 'file' },
            ],
            sha: 'mock-sha',
          },
        }}
        mockAdapters={{
          fileSystem: {
            readFile: async () => mockSubagent.content,
          },
        }}
      >
        {({ context, actions }) => (
          <AgentDetailPanel
            context={context}
            actions={actions}
            events={mockEvents as unknown as PanelEventEmitter}
          />
        )}
      </MockPanelProvider>
    );
  },
};

export const NoSelection: Story = {
  render: () => (
    <MockPanelProvider
      mockSlices={{
        fileTree: {
          allFiles: [],
          sha: 'mock-sha',
        },
      }}
    >
      {({ context, actions }) => (
        <AgentDetailPanel
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
        <AgentDetailPanel
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
