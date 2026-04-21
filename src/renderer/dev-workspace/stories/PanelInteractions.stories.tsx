import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState, useMemo } from 'react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
import { PanelEventBus, type PanelContextValue, type DataSlice } from '@principal-ade/panel-framework-core';
import { panels as repositoryCompositionPanels } from '@industry-theme/repository-composition-panels';
import {
  CodeCityPanel,
  type CodeCityPanelContext,
  type FileCityColorModesSliceData,
} from '@industry-theme/file-city-panel';

// Extended context type that includes typed slice properties
interface StoryPanelContext extends PanelContextValue, CodeCityPanelContext {
  gitStatusWithFiles: DataSlice<{
    repoPath: string;
    branch: string;
    isDirty: boolean;
    hasUntracked: boolean;
    hasStaged: boolean;
    ahead: number;
    behind: number;
    watchingEnabled: boolean;
    modifiedFiles: string[];
    untrackedFiles: string[];
    stagedFiles: string[];
    createdFiles: string[];
    deletedFiles: string[];
    hash: string;
  } | null>;
  packages: DataSlice<null>;
}
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import { GitFileTreeBuilder } from '@principal-ai/repository-abstraction';

// Mock file tree data using GitFileTreeBuilder
const createMockFileTree = () => {
  const builder = new GitFileTreeBuilder();

  // Generate random files to simulate changes
  const randomNum = Math.floor(Math.random() * 1000);
  const baseFiles = [
    { path: 'src/index.ts', size: 1234, lastModified: new Date() },
    { path: 'src/App.tsx', size: 2345, lastModified: new Date() },
    { path: 'package.json', size: 567, lastModified: new Date() },
    { path: 'README.md', size: 890, lastModified: new Date() },
  ];

  // Add some random files to show changes
  const extraFiles = [
    { path: `src/Component${randomNum}.tsx`, size: 500 + randomNum, lastModified: new Date() },
    { path: `src/utils/helper${randomNum}.ts`, size: 300 + randomNum, lastModified: new Date() },
  ];

  const files = [...baseFiles, ...extraFiles.slice(0, Math.floor(Math.random() * 2) + 1)];

  const tree = builder.build({
    commitSha: `mock-sha-${randomNum}`,
    branch: 'main',
    rootPath: '/mock-repo',
    isDirty: true,
    files,
  });

  // Debug logging
  console.info('[createMockFileTree] Built tree with', files.length, 'files');

  return tree;
};

// Mock git status data (matches GitStatusWithFiles interface)
const createMockGitStatus = () => {
  const randomNum = Math.floor(Math.random() * 1000);

  // Randomly vary the files to show changes
  const modifiedFiles = ['src/App.tsx'];
  const untrackedFiles = ['README.md'];
  const stagedFiles = ['src/NewComponent.tsx'];

  if (randomNum % 3 === 0) {
    modifiedFiles.push(`src/utils/helper${randomNum}.ts`);
  }
  if (randomNum % 2 === 0) {
    untrackedFiles.push(`temp${randomNum}.log`);
  }

  return {
    repoPath: '/mock-repo',
    branch: 'main',
    isDirty: true,
    hasUntracked: untrackedFiles.length > 0,
    hasStaged: stagedFiles.length > 0,
    ahead: Math.floor(randomNum % 3),
    behind: 0,
    watchingEnabled: true,
    modifiedFiles,
    untrackedFiles,
    stagedFiles,
    createdFiles: stagedFiles,
    deletedFiles: [],
    hash: `mock-hash-${randomNum}`,
  };
};

// Mock context provider
const MockRepositoryPanelProvider: React.FC<{
  children: (props: {
    context: StoryPanelContext;
    actions: Record<string, unknown>;
    events: PanelEventBus;
  }) => React.ReactNode;
}> = ({ children }) => {
  const [fileTree, setFileTree] = useState(createMockFileTree());
  const [gitStatus, setGitStatus] = useState(createMockGitStatus());
  const events = useMemo(() => new PanelEventBus(), []);

  // Listen for workspace:changed events and regenerate file tree
  React.useEffect(() => {
    const unsubscribe = events.on('workspace:changed', () => {
      console.info('[MockProvider] workspace:changed - regenerating file tree');
      setFileTree(createMockFileTree());
    });

    return () => {
      unsubscribe();
    };
  }, [events]);

  // Listen for git:statusChanged events and regenerate git status
  React.useEffect(() => {
    const unsubscribe = events.on('git:statusChanged', () => {
      console.info('[MockProvider] git:statusChanged - regenerating git status');
      setGitStatus(createMockGitStatus());
    });

    return () => {
      unsubscribe();
    };
  }, [events]);

  // Create typed slice objects for direct property access
  const fileTreeSlice: DataSlice<typeof fileTree> = useMemo(
    () => ({
      scope: 'repository' as const,
      name: 'fileTree',
      data: fileTree,
      loading: false,
      error: null,
      refresh: async () => {},
    }),
    [fileTree],
  );

  const gitStatusWithFilesSlice: DataSlice<typeof gitStatus | null> = useMemo(
    () => ({
      scope: 'repository' as const,
      name: 'gitStatusWithFiles',
      data: gitStatus,
      loading: false,
      error: null,
      refresh: async () => {},
    }),
    [gitStatus],
  );

  const fileCityColorModesSlice: DataSlice<FileCityColorModesSliceData> = useMemo(
    () => ({
      scope: 'repository' as const,
      name: 'fileCityColorModes',
      data: { mode: 'git' } as FileCityColorModesSliceData,
      loading: false,
      error: null,
      refresh: async () => {},
    }),
    [],
  );

  const packagesSlice: DataSlice<null> = useMemo(
    () => ({
      scope: 'repository' as const,
      name: 'packages',
      data: null,
      loading: false,
      error: null,
      refresh: async () => {},
    }),
    [],
  );

  const context = useMemo(
    (): StoryPanelContext => ({
      currentScope: {
        type: 'repository' as const,
        repository: {
          path: '/mock-repo',
          name: 'mock-repo',
        },
      },
      // Typed slice properties for direct access
      fileTree: fileTreeSlice,
      gitStatusWithFiles: gitStatusWithFilesSlice,
      fileCityColorModes: fileCityColorModesSlice,
      packages: packagesSlice,
      refresh: async (_scope?: 'workspace' | 'repository', _slice?: string): Promise<void> => {
        // Mock refresh - no-op
      },
    }),
    [fileTreeSlice, gitStatusWithFilesSlice, fileCityColorModesSlice, packagesSlice],
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
    terminalContext: { terminalSessions: unknown[] };
    terminalActions: import('@industry-theme/xterm-terminal-panel').TerminalPanelActions;
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
      createTerminalSession: async () => 'mock-session-id',
      destroyTerminalSession: async () => {},
      writeToTerminal: () => {},
      resizeTerminal: () => {},
      clearTerminal: () => {},
      onTerminalPortReady: () => () => {},
      checkTerminalOwnership: async () => ({
        exists: true,
        ownedByWindowId: 1,
        ownedByThisWindow: true,
        canClaim: true,
      }),
      claimTerminalOwnership: async () => ({ success: true }),
      releaseTerminalOwnership: async () => ({ success: true }),
      onOwnershipLost: () => () => {},
      refreshTerminal: async () => true,
      requestTerminalDataPort: async () => ({ success: true }),
      onTerminalData: () => () => {},
      listTerminalSessions: async () => [],
      openFile: () => {},
      openGitDiff: () => {},
      navigateToPanel: () => {},
      notifyPanels: () => {},
    }),
    [],
  );

  return <>{children({ terminalContext, terminalActions })}</>;
};

// Inner story component that uses theme
const PanelInteractionsStoryInner: React.FC = () => {
  const { theme } = useTheme();

  const [layout] = useState<PanelLayout>({
    left: 'gitChanges',
    middle: 'terminal',
    right: 'fileCity',
  });

  const [collapsed, _setCollapsed] = useState({
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
  const FileCityPanelComponent = CodeCityPanel;

  // Debug logging
  React.useEffect(() => {
    console.info('GitChangesPanelComponent:', GitChangesPanelComponent);
    console.info('FileCityPanelComponent:', FileCityPanelComponent);
    console.info('TabbedTerminalPanel:', TabbedTerminalPanel);
    console.info('ThemeProvider:', ThemeProvider);
    console.info('ConfigurablePanelLayout:', ConfigurablePanelLayout);
    console.info('theme:', theme);
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
                terminal: {
                  scope: 'repository' as const,
                  name: 'terminal',
                  data: [],
                  loading: false,
                  error: null,
                  refresh: async () => {},
                },
              };

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
              if (!ConfigurablePanelLayout) {
                return (
                  <div style={{ padding: '2rem', color: '#fff' }}>
                    Error: ConfigurablePanelLayout not available
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
                          console.info('Emit workspace:changed event');
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
                          console.info('Emit git:statusChanged event');
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
                        Current Layout: {typeof layout.left === 'string' ? layout.left : 'none'} | {typeof layout.middle === 'string' ? layout.middle : 'none'} |{' '}
                        {typeof layout.right === 'string' ? layout.right : 'none'}
                      </div>
                    </div>
                  </div>

                  {/* Panel Layout */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <ConfigurablePanelLayout
                      panels={panels}
                      layout={layout}
                      collapsiblePanels={{ left: true, right: true }}
                      defaultSizes={panelSizes}
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
