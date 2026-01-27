import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState, useMemo } from 'react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';
import {
  EditableConfigurablePanelLayout,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { panels as repositoryCompositionPanels } from '@industry-theme/repository-composition-panels';
import { panels as fileCityPanels } from '@industry-theme/file-city-panel';
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import { GitFileTreeBuilder } from '@principal-ai/repository-abstraction';

// Mock file tree data using GitFileTreeBuilder
const createMockFileTree = () => {
  const builder = new GitFileTreeBuilder();
  const tree = builder.build({
    commitSha: 'mock-sha-abc123',
    branch: 'main',
    rootPath: '/mock-repo',
    isDirty: true,
    files: [
      {
        path: '/mock-repo/src/index.ts',
        size: 1234,
        lastModified: new Date(),
      },
      {
        path: '/mock-repo/src/App.tsx',
        size: 2345,
        lastModified: new Date(),
      },
      {
        path: '/mock-repo/package.json',
        size: 567,
        lastModified: new Date(),
      },
      {
        path: '/mock-repo/README.md',
        size: 890,
        lastModified: new Date(),
      },
    ],
  });

  // Debug logging
  console.log('[createMockFileTree] Built tree:', tree);
  console.log('[createMockFileTree] Root:', tree.root);
  console.log('[createMockFileTree] Root children:', tree.root.children);
  if (tree.root.children && tree.root.children[0]) {
    console.log('[createMockFileTree] First child:', tree.root.children[0]);
  }

  return tree;
};

// Mock git status data (matches GitStatusWithFiles interface)
const createMockGitStatus = () => ({
  repoPath: '/mock-repo',
  branch: 'main',
  isDirty: true,
  hasUntracked: true,
  hasStaged: true,
  ahead: 0,
  behind: 0,
  watchingEnabled: true,
  modifiedFiles: ['/mock-repo/src/App.tsx'],
  untrackedFiles: ['/mock-repo/README.md'],
  stagedFiles: ['/mock-repo/src/NewComponent.tsx'],
  createdFiles: ['/mock-repo/src/NewComponent.tsx'],
  deletedFiles: [],
  hash: 'mock-hash-123',
});

// Mock context provider
const MockRepositoryPanelProvider: React.FC<{
  children: (props: {
    context: any;
    actions: any;
    events: PanelEventBus;
  }) => React.ReactNode;
}> = ({ children }) => {
  const [fileTree] = useState(createMockFileTree());
  const [gitStatus] = useState(createMockGitStatus());
  const events = useMemo(() => new PanelEventBus(), []);

  const context = useMemo(
    () => ({
      currentScope: {
        type: 'repository' as const,
        repository: {
          path: '/mock-repo',
          name: 'mock-repo',
        },
      },
      slices: new Map([
        [
          'fileTree',
          {
            scope: 'repository' as const,
            name: 'fileTree',
            data: fileTree,
            loading: false,
            error: null,
            refresh: async () => {},
          },
        ],
        [
          'gitStatusWithFiles',
          {
            scope: 'repository' as const,
            name: 'gitStatusWithFiles',
            data: gitStatus,
            loading: false,
            error: null,
            refresh: async () => {},
          },
        ],
        [
          'fileCityColorModes',
          {
            scope: 'repository' as const,
            name: 'fileCityColorModes',
            data: { mode: 'git' },
            loading: false,
            error: null,
            refresh: async () => {},
          },
        ],
      ]),
      getSlice: function <T = unknown>(name: string) {
        return this.slices.get(name) as
          | {
              scope: string;
              name: string;
              data: T;
              loading: boolean;
              error: unknown;
              refresh: () => Promise<void>;
            }
          | undefined;
      },
    }),
    [fileTree, gitStatus],
  );

  const actions = useMemo(
    () => ({
      // Add any actions needed by panels
    }),
    [],
  );

  return <>{children({ context, actions, events })}</>;
};

// Mock terminal provider
const MockTerminalProvider: React.FC<{
  children: (props: {
    terminalContext: { terminalSessions: any[] };
    terminalActions: any;
  }) => React.ReactNode;
}> = ({ children }) => {
  const terminalContext = useMemo(
    () => ({
      terminalSessions: [],
    }),
    [],
  );

  const terminalActions = useMemo(
    () => ({
      createSession: () => {},
      closeSession: () => {},
    }),
    [],
  );

  return <>{children({ terminalContext, terminalActions })}</>;
};

// Inner story component that uses theme
const PanelInteractionsStoryInner: React.FC = () => {
  const { theme } = useTheme();

  const [layout, setLayout] = useState<PanelLayout>({
    left: 'gitChanges',
    middle: 'terminal',
    right: 'fileCity',
  });

  const [collapsed, setCollapsed] = useState({
    left: false,
    right: false,
  });

  const [panelSizes, setPanelSizes] = useState({
    left: 25,
    middle: 50,
    right: 25,
  });

  // Get panel components
  const GitChangesPanelComponent = repositoryCompositionPanels.find(
    (p) => p.metadata?.id === 'industry-theme.git-changes',
  )?.component;
  const FileCityPanelComponent = fileCityPanels[0]?.component;

  // Debug logging
  React.useEffect(() => {
    console.log('GitChangesPanelComponent:', GitChangesPanelComponent);
    console.log('FileCityPanelComponent:', FileCityPanelComponent);
    console.log('TabbedTerminalPanel:', TabbedTerminalPanel);
    console.log('ThemeProvider:', ThemeProvider);
    console.log('EditableConfigurablePanelLayout:', EditableConfigurablePanelLayout);
    console.log('theme:', theme);
  }, [GitChangesPanelComponent, FileCityPanelComponent, theme]);

  return (
    <MockRepositoryPanelProvider>
        {({ context, actions, events }) => (
          <MockTerminalProvider>
            {({ terminalContext, terminalActions }) => {
              // Merge terminal context into panel context
              const terminalPanelContext = {
                ...context,
                ...terminalContext,
              };

              // Debug logging
              console.log('[Story] Context slices:', context.slices);
              console.log('[Story] fileTree slice:', context.getSlice('fileTree'));
              console.log('[Story] gitStatusWithFiles slice:', context.getSlice('gitStatusWithFiles'));
              console.log('[Story] fileTree data:', context.getSlice('fileTree')?.data);
              console.log('[Story] gitStatus data:', context.getSlice('gitStatusWithFiles')?.data);

              // Define panels
              const panels = [
                {
                  id: 'gitChanges',
                  label: 'Git Changes',
                  content: GitChangesPanelComponent ? (
                    <div
                      style={{
                        height: '100%',
                        width: '100%',
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <GitChangesPanelComponent
                        context={context}
                        actions={actions}
                        events={events}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '2rem', color: '#999' }}>
                      Git Changes panel not available
                    </div>
                  ),
                },
                {
                  id: 'terminal',
                  label: 'Terminal',
                  content: TabbedTerminalPanel ? (
                    <div
                      style={{
                        height: '100%',
                        width: '100%',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <TabbedTerminalPanel
                        context={terminalPanelContext}
                        actions={terminalActions}
                        events={events}
                        terminalContext="terminal:default"
                        directory="/mock-repo"
                        initialTabs={[]}
                        onTabsChange={() => {}}
                        renderTabContent={() => null}
                        width={800}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '2rem', color: '#999' }}>
                      Terminal panel not available
                    </div>
                  ),
                },
                {
                  id: 'fileCity',
                  label: 'File City',
                  content: FileCityPanelComponent ? (
                    <div
                      style={{
                        height: '100%',
                        width: '100%',
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <FileCityPanelComponent
                        context={context}
                        actions={actions}
                        events={events}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '2rem', color: '#999' }}>
                      File City panel not available
                    </div>
                  ),
                },
              ];

              // Check if required components are available
              if (!EditableConfigurablePanelLayout) {
                return (
                  <div style={{ padding: '2rem', color: '#fff' }}>
                    Error: EditableConfigurablePanelLayout not available
                  </div>
                );
              }

              return (
                <div
                  style={{
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#1a1a1a',
                  }}
                >
                  {/* Control Panel - Space for file tree event controls */}
                  <div
                    style={{
                      height: '120px',
                      borderBottom: '1px solid #333',
                      padding: '16px',
                      background: '#252525',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        color: '#fff',
                        fontSize: '16px',
                        fontWeight: '600',
                      }}
                    >
                      File Tree Event Controls
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#444',
                          color: '#fff',
                          border: '1px solid #666',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                        onClick={() => {
                          console.log('Emit workspace:changed event');
                          events.emit({
                            type: 'workspace:changed',
                            source: 'story-control',
                            timestamp: Date.now(),
                            payload: {},
                          });
                        }}
                      >
                        Trigger File Tree Refresh
                      </button>
                      <button
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#444',
                          color: '#fff',
                          border: '1px solid #666',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                        onClick={() => {
                          console.log('Emit git:statusChanged event');
                          events.emit({
                            type: 'git:statusChanged',
                            source: 'story-control',
                            timestamp: Date.now(),
                            payload: {},
                          });
                        }}
                      >
                        Trigger Git Status Update
                      </button>
                      <div
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#333',
                          color: '#6495ed',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        Current Layout: {layout.left} | {layout.middle} |{' '}
                        {layout.right}
                      </div>
                    </div>
                  </div>

                  {/* Panel Layout */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <EditableConfigurablePanelLayout
                      panels={panels}
                      layout={layout}
                      onLayoutChange={setLayout}
                      isEditMode={false}
                      collapsiblePanels={{ left: true, right: true }}
                      defaultSizes={panelSizes}
                      minSizes={{ left: 15, middle: 30, right: 15 }}
                      collapsed={collapsed}
                      showCollapseButtons={true}
                      onPanelResize={setPanelSizes}
                      theme={theme}
                    />
                  </div>
                </div>
              );
            }}
          </MockTerminalProvider>
        )}
      </MockRepositoryPanelProvider>
  );
};

// Story component wrapper
const PanelInteractionsStory: React.FC = () => {
  return (
    <ThemeProvider>
      <PanelInteractionsStoryInner />
    </ThemeProvider>
  );
};

const meta = {
  title: 'DevWorkspace/Panel Interactions',
  component: PanelInteractionsStory,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#1a1a1a' }],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PanelInteractionsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Testing file tree interactions with Git Changes panel on the left.
 * This story demonstrates how file tree changes propagate to different panels.
 */
export const GitChangesPanel: Story = {
  render: () => <PanelInteractionsStory />,
};
