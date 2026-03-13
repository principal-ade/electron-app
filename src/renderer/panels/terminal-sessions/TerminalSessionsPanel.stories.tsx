import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import { TerminalSessionsPanel } from './TerminalSessionsPanel';
import type { TerminalSessionInfo } from '../../../shared/tipc/terminalRouterTypes';

// Mock event emitter for stories
type EventHandler = (event: PanelEvent<unknown>) => void;

class MockEventEmitter implements PanelEventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  emit<T>(event: PanelEvent<T>): void {
    console.info('[Mock Event]:', event);
    const eventListeners = this.listeners.get(event.type) || [];
    eventListeners.forEach((listener) => listener(event as PanelEvent<unknown>));
  }

  on<T>(eventType: string, handler: (event: PanelEvent<T>) => void): () => void {
    const listeners = this.listeners.get(eventType) || [];
    const wrappedHandler = handler as EventHandler;
    listeners.push(wrappedHandler);
    this.listeners.set(eventType, listeners);

    return () => {
      const currentListeners = this.listeners.get(eventType) || [];
      const index = currentListeners.indexOf(wrappedHandler);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  off<T>(eventType: string, handler: (event: PanelEvent<T>) => void): void {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(handler as EventHandler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

// Mock terminal session data generator
const createMockSessions = (
  count: number = 5,
  options: {
    includeAgentSessions?: boolean;
    includeDisconnected?: boolean;
    includeOtherWindow?: boolean;
  } = {}
): TerminalSessionInfo[] => {
  const {
    includeAgentSessions = true,
    includeDisconnected = true,
    includeOtherWindow = true,
  } = options;

  const directories = [
    '/Users/dev/projects/my-app',
    '/Users/dev/projects/api-server',
    '/Users/dev/projects/shared-utils',
    '/Users/dev/projects/frontend',
    '/Users/dev/projects/backend',
    '/Users/dev/projects/mobile-app',
    '/Users/dev/projects/design-system',
    '/Users/dev/projects/cli-tools',
  ];

  const packageNames = [
    'my-app',
    'api-server',
    'shared-utils',
    'frontend',
    'backend',
    'mobile-app',
    'design-system',
    'cli-tools',
  ];

  const serverTypes: Array<'storybook' | 'dev' | 'preview' | 'test' | undefined> = [
    'dev',
    'storybook',
    'preview',
    'test',
    undefined,
  ];

  const ports = [3000, 6006, 4173, 8080, 5173, undefined];

  const now = Date.now();

  return Array.from({ length: count }, (_, i) => {
    const isAgent = includeAgentSessions && i % 3 === 0;
    const isDisconnected = includeDisconnected && i % 5 === 0;
    const isOtherWindow = includeOtherWindow && i % 4 === 1;
    const serverType = serverTypes[i % serverTypes.length];
    const port = serverType ? ports[i % ports.length] : undefined;

    return {
      id: `session-${i + 1}`,
      cwd: directories[i % directories.length],
      directory: directories[i % directories.length],
      context: `/Users/dev/projects/${packageNames[i % packageNames.length]}`,
      agentSessionId: isAgent ? `agent-${i}` : undefined,
      createdAt: now - (count - i) * 60000 * 5, // 5 minutes apart
      lastActivity: now - i * 60000, // 1 minute apart
      status: isDisconnected ? 'disconnected' : 'active',
      ownedByWindowId: isOtherWindow ? 2 : 1,
      metadata: serverType
        ? {
            packageName: packageNames[i % packageNames.length],
            serverType,
            port,
          }
        : undefined,
    };
  });
};

// Mock context with terminal slice
interface MockTerminalContext extends PanelContextValue {
  terminal?: DataSlice<TerminalSessionInfo[]>;
}

// Mock panel wrapper component
const MockTerminalSessionsPanel: React.FC<{
  sessions?: TerminalSessionInfo[];
  loading?: boolean;
}> = ({ sessions = createMockSessions(), loading = false }) => {
  const terminalSlice: DataSlice<TerminalSessionInfo[]> = {
    name: 'terminal',
    scope: 'global',
    data: sessions,
    loading,
    error: null,
    refresh: async () => {
      console.info('[Mock] Refreshing terminal sessions');
    },
  };

  const mockContext: MockTerminalContext = {
    currentScope: {
      type: 'repository',
      repository: {
        path: '/Users/dev/projects/my-app',
        name: 'my-app',
      },
    },
    terminal: terminalSlice,
    getSlice: () => terminalSlice,
    hasSlice: () => true,
    isSliceLoading: () => loading,
    refresh: async () => {},
    clearSlice: () => {},
  } as unknown as MockTerminalContext;

  const mockActions: PanelActions = {
    openFile: async () => {},
    openRepository: async () => {},
  } as unknown as PanelActions;

  const mockEvents = new MockEventEmitter();

  return (
    <TerminalSessionsPanel
      context={mockContext}
      actions={mockActions}
      events={mockEvents}
    />
  );
};

// Wrapper with theme provider
const TerminalSessionsPanelStory: React.FC<{
  sessions?: TerminalSessionInfo[];
  loading?: boolean;
}> = (props) => {
  return (
    <ThemeProvider>
      <MockTerminalSessionsPanel {...props} />
    </ThemeProvider>
  );
};

const meta: Meta<typeof TerminalSessionsPanel> = {
  title: 'Panels/TerminalSessionsPanel',
  component: TerminalSessionsPanel,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1a' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '16px', width: '100vw', height: '100vh', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', height: '100%' }}>
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with mixed sessions
export const Default = {
  render: () => <TerminalSessionsPanelStory />,
} as unknown as Story;

// Empty state - no sessions
export const Empty = {
  render: () => <TerminalSessionsPanelStory sessions={[]} />,
} as unknown as Story;

// Single session
export const SingleSession = {
  render: () => (
    <TerminalSessionsPanelStory
      sessions={[
        {
          id: 'session-1',
          cwd: '/Users/dev/projects/my-app',
          directory: '/Users/dev/projects/my-app',
          context: '/Users/dev/projects/my-app',
          createdAt: Date.now() - 300000,
          lastActivity: Date.now() - 60000,
          status: 'active',
          ownedByWindowId: 1,
          metadata: {
            packageName: 'my-app',
            serverType: 'dev',
            port: 3000,
          },
        },
      ]}
    />
  ),
} as unknown as Story;

// All active sessions (local window only)
export const AllActiveLocal = {
  render: () => (
    <TerminalSessionsPanelStory
      sessions={createMockSessions(5, {
        includeDisconnected: false,
        includeOtherWindow: false,
      })}
    />
  ),
} as unknown as Story;

// Sessions with agents
export const WithAgentSessions = {
  render: () => {
    const sessions = createMockSessions(4, {
      includeDisconnected: false,
      includeOtherWindow: false,
    }).map((session, i) => ({
      ...session,
      agentSessionId: i < 2 ? `agent-${i}` : undefined,
    }));
    return <TerminalSessionsPanelStory sessions={sessions} />;
  },
} as unknown as Story;

// Dev server sessions
export const DevServerSessions = {
  render: () => {
    const sessions: TerminalSessionInfo[] = [
      {
        id: 'session-1',
        directory: '/Users/dev/projects/frontend',
        createdAt: Date.now() - 600000,
        lastActivity: Date.now() - 30000,
        status: 'active',
        ownedByWindowId: 1,
        metadata: { packageName: 'frontend', serverType: 'dev', port: 5173 },
      },
      {
        id: 'session-2',
        directory: '/Users/dev/projects/design-system',
        createdAt: Date.now() - 500000,
        lastActivity: Date.now() - 120000,
        status: 'active',
        ownedByWindowId: 1,
        metadata: { packageName: 'design-system', serverType: 'storybook', port: 6006 },
      },
      {
        id: 'session-3',
        directory: '/Users/dev/projects/api-server',
        createdAt: Date.now() - 400000,
        lastActivity: Date.now() - 180000,
        status: 'active',
        ownedByWindowId: 1,
        metadata: { packageName: 'api-server', serverType: 'dev', port: 3000 },
      },
      {
        id: 'session-4',
        directory: '/Users/dev/projects/frontend',
        createdAt: Date.now() - 300000,
        lastActivity: Date.now() - 60000,
        status: 'active',
        ownedByWindowId: 1,
        metadata: { packageName: 'frontend', serverType: 'preview', port: 4173 },
      },
    ];
    return <TerminalSessionsPanelStory sessions={sessions} />;
  },
} as unknown as Story;

// Mixed sessions from multiple windows
export const MultiWindowSessions = {
  render: () => {
    const sessions: TerminalSessionInfo[] = [
      {
        id: 'session-1',
        directory: '/Users/dev/projects/frontend',
        createdAt: Date.now() - 600000,
        lastActivity: Date.now() - 30000,
        status: 'active',
        ownedByWindowId: 1,
        metadata: { packageName: 'frontend', serverType: 'dev', port: 5173 },
      },
      {
        id: 'session-2',
        directory: '/Users/dev/projects/backend',
        createdAt: Date.now() - 500000,
        lastActivity: Date.now() - 120000,
        status: 'active',
        ownedByWindowId: 2,
        metadata: { packageName: 'backend', serverType: 'dev', port: 3000 },
      },
      {
        id: 'session-3',
        directory: '/Users/dev/projects/api-server',
        createdAt: Date.now() - 400000,
        lastActivity: Date.now() - 180000,
        status: 'active',
        ownedByWindowId: 3,
      },
      {
        id: 'session-4',
        directory: '/Users/dev/projects/mobile-app',
        createdAt: Date.now() - 300000,
        lastActivity: Date.now() - 60000,
        status: 'active',
        ownedByWindowId: 1,
      },
    ];
    return <TerminalSessionsPanelStory sessions={sessions} />;
  },
} as unknown as Story;

// Disconnected sessions
export const WithDisconnectedSessions = {
  render: () => {
    const sessions: TerminalSessionInfo[] = [
      {
        id: 'session-1',
        directory: '/Users/dev/projects/frontend',
        createdAt: Date.now() - 600000,
        lastActivity: Date.now() - 30000,
        status: 'active',
        ownedByWindowId: 1,
      },
      {
        id: 'session-2',
        directory: '/Users/dev/projects/backend',
        createdAt: Date.now() - 500000,
        lastActivity: Date.now() - 3600000, // 1 hour ago
        status: 'disconnected',
        ownedByWindowId: 1,
      },
      {
        id: 'session-3',
        directory: '/Users/dev/projects/api-server',
        createdAt: Date.now() - 400000,
        lastActivity: Date.now() - 180000,
        status: 'active',
        ownedByWindowId: 1,
      },
      {
        id: 'session-4',
        directory: '/Users/dev/projects/mobile-app',
        createdAt: Date.now() - 300000,
        lastActivity: Date.now() - 7200000, // 2 hours ago
        status: 'disconnected',
        ownedByWindowId: 1,
      },
    ];
    return <TerminalSessionsPanelStory sessions={sessions} />;
  },
} as unknown as Story;

// Loading state
export const Loading = {
  render: () => <TerminalSessionsPanelStory sessions={[]} loading={true} />,
} as unknown as Story;

// Many sessions (scrolling)
export const ManySessions = {
  render: () => <TerminalSessionsPanelStory sessions={createMockSessions(15)} />,
} as unknown as Story;

// Interactive demo with controls
export const Interactive = {
  render: () => {
    const InteractivePanel: React.FC = () => {
      const [sessionCount, setSessionCount] = useState(5);
      const [includeAgents, setIncludeAgents] = useState(true);
      const [includeDisconnected, setIncludeDisconnected] = useState(true);
      const [includeOtherWindow, setIncludeOtherWindow] = useState(true);
      const [isLoading, setIsLoading] = useState(false);

      const sessions = createMockSessions(sessionCount, {
        includeAgentSessions: includeAgents,
        includeDisconnected,
        includeOtherWindow,
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          {/* Control Panel */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #3a3a3a',
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Sessions:
              <input
                type="number"
                value={sessionCount}
                onChange={(e) => setSessionCount(parseInt(e.target.value) || 0)}
                min={0}
                max={20}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  color: '#fff',
                  width: '60px',
                }}
              />
            </label>
            <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={includeAgents}
                onChange={(e) => setIncludeAgents(e.target.checked)}
              />
              Agent Sessions
            </label>
            <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={includeDisconnected}
                onChange={(e) => setIncludeDisconnected(e.target.checked)}
              />
              Disconnected
            </label>
            <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={includeOtherWindow}
                onChange={(e) => setIncludeOtherWindow(e.target.checked)}
              />
              Other Windows
            </label>
            <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={isLoading}
                onChange={(e) => setIsLoading(e.target.checked)}
              />
              Loading
            </label>
          </div>

          {/* Panel */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TerminalSessionsPanelStory sessions={sessions} loading={isLoading} />
          </div>
        </div>
      );
    };

    return <InteractivePanel />;
  },
} as unknown as Story;
