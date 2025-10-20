import type { Meta, StoryObj } from '@storybook/react';
import { useState, useRef, useEffect } from 'react';
import { ThemeProvider } from '@a24z/industry-theme';
import { MultiTerminalPanel } from './MultiTerminalPanel';

// Mock terminal service for Storybook
class MockTerminalService {
  private static sessions = new Map<
    string,
    {
      id: string;
      directory: string;
      context?: string;
      buffer: string;
      status: string;
      lastActivity: string;
    }
  >();

  private static listeners = {
    data: [] as Array<(data: { sessionId: string; data: string }) => void>,
    exit: [] as Array<(data: { sessionId: string; code: number }) => void>,
    ownershipLost: [] as Array<
      (data: { sessionId: string; newOwnerWindowId: number }) => void
    >,
  };

  static async list() {
    return Array.from(this.sessions.values()).map((session) => ({
      ...session,
      ownedByWindowId: null,
    }));
  }

  static async create(dir: string, context?: string): Promise<string> {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessions.set(id, {
      id,
      directory: dir,
      context,
      buffer: '',
      status: 'active',
      lastActivity: new Date().toISOString(),
    });
    return id;
  }

  static async getOrCreate(dir: string, context?: string): Promise<string> {
    const existing = Array.from(this.sessions.values()).find(
      (s) => s.directory === dir && s.context === context,
    );
    if (existing) {
      return existing.id;
    }
    return this.create(dir, context);
  }

  static async createWithCommand(
    dir: string,
    command: string,
    context?: string,
  ): Promise<string> {
    const id = await this.create(dir, context);
    const session = this.sessions.get(id);
    if (session) {
      session.buffer = `$ ${command}\r\n`;
    }
    return id;
  }

  static async destroy(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  static async write(id: string, data: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.buffer += data;
      session.lastActivity = new Date().toISOString();
      // Echo back to all listeners
      this.listeners.data.forEach((listener) =>
        listener({ sessionId: id, data }),
      );
    }
  }

  static async onData(
    callback: (data: { sessionId: string; data: string }) => void,
  ): Promise<() => void> {
    this.listeners.data.push(callback);
    return () => {
      const index = this.listeners.data.indexOf(callback);
      if (index > -1) {
        this.listeners.data.splice(index, 1);
      }
    };
  }

  static async onExit(
    callback: (exit: { sessionId: string; code: number }) => void,
  ): Promise<() => void> {
    this.listeners.exit.push(callback);
    return () => {
      const index = this.listeners.exit.indexOf(callback);
      if (index > -1) {
        this.listeners.exit.splice(index, 1);
      }
    };
  }

  static async resize(id: string, cols: number, rows: number): Promise<void> {
    // No-op for mock
  }

  static async refresh(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (session && session.buffer) {
      // Simulate sending the buffer contents
      this.listeners.data.forEach((listener) =>
        listener({ sessionId: id, data: session.buffer }),
      );
      return true;
    }
    return false;
  }

  static async checkOwnership(sessionId: string) {
    return {
      exists: this.sessions.has(sessionId),
      ownedByThisWindow: true,
      canClaim: true,
      ownedByWindowId: null,
    };
  }

  static async claimOwnership(sessionId: string, force?: boolean) {
    return {
      success: true,
      ownedByWindowId: null,
    };
  }

  static async releaseOwnership(sessionId: string) {
    // No-op for mock
  }

  static onOwnershipLost(
    callback: (data: { sessionId: string; newOwnerWindowId: number }) => void,
  ) {
    this.listeners.ownershipLost.push(callback);
    return () => {
      const index = this.listeners.ownershipLost.indexOf(callback);
      if (index > -1) {
        this.listeners.ownershipLost.splice(index, 1);
      }
    };
  }

  static async popOut(id: string) {
    return { windowId: 123 };
  }

  static async focusWindow(windowId: number) {
    // No-op for mock
  }

  static async getOpenWindows() {
    return [];
  }

  // Helper to add test content to a session
  static addContent(id: string, content: string) {
    const session = this.sessions.get(id);
    if (session) {
      session.buffer += content;
      // Notify listeners
      this.listeners.data.forEach((listener) =>
        listener({ sessionId: id, data: content }),
      );
    }
  }
}

// Mock window.mainProcess for Storybook
if (typeof window !== 'undefined') {
  (window as any).mainProcess = {
    terminal: MockTerminalService,
  };
}

const meta = {
  title: 'Components/MultiTerminalPanel',
  component: MultiTerminalPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof MultiTerminalPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Test terminal mode switching with interactive controls
 * This story allows you to test the fix for terminal content not showing
 * when switching between tabbed and carousel modes.
 */
export const ModeSwitchingTest: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    const [sessionIds, setSessionIds] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize some test sessions with content
    useEffect(() => {
      const initSessions = async () => {
        // Clear any existing sessions
        const existing = await MockTerminalService.list();
        for (const session of existing) {
          await MockTerminalService.destroy(session.id);
        }

        // Create test sessions with rich content
        const session1 = await MockTerminalService.create(
          '/home/user/project',
          'terminal:test-repo',
        );
        MockTerminalService.addContent(
          session1,
          '$ npm run dev\r\n' +
            '\x1b[36mStarting development server...\x1b[0m\r\n' +
            '\x1b[32m✓\x1b[0m TypeScript compiled successfully\r\n' +
            '\x1b[32m✓\x1b[0m Webpack bundled successfully\r\n' +
            '\r\n' +
            'Server running at:\r\n' +
            '  \x1b]8;;http://localhost:3000\x1b\\http://localhost:3000\x1b]8;;\x1b\\\r\n' +
            '\r\n' +
            '\x1b[33mReady in 2.3s\x1b[0m\r\n' +
            '$ ',
        );

        const session2 = await MockTerminalService.create(
          '/home/user/project',
          'terminal:test-repo',
        );
        MockTerminalService.addContent(
          session2,
          '$ git status\r\n' +
            'On branch main\r\n' +
            "Your branch is up to date with 'origin/main'.\r\n" +
            '\r\n' +
            'Changes not staged for commit:\r\n' +
            '  (use "git add <file>..." to update what will be committed)\r\n' +
            '  (use "git restore <file>..." to discard changes in working directory)\r\n' +
            '\x1b[31m        modified:   src/main.ts\x1b[0m\r\n' +
            '\x1b[31m        modified:   src/utils.ts\x1b[0m\r\n' +
            '\r\n' +
            'Untracked files:\r\n' +
            '  (use "git add <file>..." to include in what will be committed)\r\n' +
            '\x1b[31m        src/new-feature.ts\x1b[0m\r\n' +
            '\r\n' +
            'no changes added to commit (use "git add" and/or "git commit -a")\r\n' +
            '$ ',
        );

        const session3 = await MockTerminalService.create(
          '/home/user/project',
          'terminal:test-repo',
        );
        MockTerminalService.addContent(
          session3,
          '$ npm test\r\n' +
            '\r\n' +
            '\x1b[1mJest Test Runner\x1b[0m\r\n' +
            '\x1b[90mFound 12 test suites\x1b[0m\r\n' +
            '\r\n' +
            '\x1b[1mauth.test.ts\x1b[0m\r\n' +
            '  \x1b[32m✓\x1b[0m should authenticate user (45ms)\r\n' +
            '  \x1b[32m✓\x1b[0m should reject invalid credentials (23ms)\r\n' +
            '  \x1b[32m✓\x1b[0m should refresh token (12ms)\r\n' +
            '\r\n' +
            '\x1b[1mapi.test.ts\x1b[0m\r\n' +
            '  \x1b[32m✓\x1b[0m should fetch data (67ms)\r\n' +
            '  \x1b[32m✓\x1b[0m should handle errors (34ms)\r\n' +
            '\r\n' +
            '\x1b[1mTest Suites: \x1b[0m\x1b[32m12 passed\x1b[0m, 12 total\r\n' +
            '\x1b[1mTests:       \x1b[0m\x1b[32m56 passed\x1b[0m, 56 total\r\n' +
            '\x1b[1mTime:        \x1b[0m3.241s\r\n' +
            '$ ',
        );

        setSessionIds([session1, session2, session3]);
      };

      initSessions();
    }, []);

    const forceRemount = () => {
      setKey((prev) => prev + 1);
    };

    const addMoreContent = async () => {
      if (sessionIds.length > 0) {
        const randomSessionId =
          sessionIds[Math.floor(Math.random() * sessionIds.length)];
        MockTerminalService.addContent(
          randomSessionId,
          'echo "New content added at ' +
            new Date().toLocaleTimeString() +
            '"\r\n' +
            'New content added at ' +
            new Date().toLocaleTimeString() +
            '\r\n' +
            '$ ',
        );
      }
    };

    const simulateWorkspaceChange = () => {
      // Simulate workspace configuration change by remounting
      forceRemount();
    };

    return (
      <div
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Control Panel */}
        <div
          style={{
            padding: '20px',
            backgroundColor: '#2a2a2a',
            borderBottom: '2px solid #444',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
            Terminal Mode Switching Test
          </div>
          <div style={{ flex: 1 }} />

          <button
            onClick={addMoreContent}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066cc',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Add More Content
          </button>

          <button
            onClick={simulateWorkspaceChange}
            style={{
              padding: '10px 20px',
              backgroundColor: '#cc6600',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Simulate Workspace Change
          </button>

          <button
            onClick={forceRemount}
            style={{
              padding: '10px 20px',
              backgroundColor: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Force Remount
          </button>
        </div>

        {/* Instructions */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #333',
            color: '#aaa',
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ color: '#fff' }}>Testing Instructions:</strong>
          </div>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>
              Notice that there are <strong>3 terminal sessions</strong> with
              different content already created
            </li>
            <li>
              Click the <strong>grid icon</strong> in the terminal panel header
              to <strong>switch between tabbed and carousel modes</strong>
            </li>
            <li>
              Verify that the <strong>terminal content persists</strong> and is
              visible after switching modes
            </li>
            <li>
              Click <strong>"Add More Content"</strong> to add content to a
              random terminal
            </li>
            <li>
              Switch modes again and verify the{' '}
              <strong>new content is visible</strong>
            </li>
            <li>
              Click <strong>"Simulate Workspace Change"</strong> to remount the
              component (simulates workspace config change)
            </li>
            <li>
              Verify that <strong>all terminal content is still visible</strong>{' '}
              after remount
            </li>
          </ol>
        </div>

        {/* Terminal Panel */}
        <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
          <MultiTerminalPanel
            key={key}
            directory="/home/user/project"
            repositoryKey="test-repo"
            isVisible={true}
            showAllTerminals={false}
          />
        </div>

        {/* Status Bar */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #333',
            color: '#888',
            fontSize: '12px',
            display: 'flex',
            gap: '20px',
          }}
        >
          <div>
            <strong style={{ color: '#0066cc' }}>Sessions:</strong>{' '}
            {sessionIds.length}
          </div>
          <div>
            <strong style={{ color: '#0066cc' }}>Mount Key:</strong> {key}
          </div>
          <div>
            <strong style={{ color: '#0066cc' }}>Fix Applied:</strong>{' '}
            TerminalService.refresh() on reconnect
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Basic multi-terminal panel (tabbed mode by default)
 */
export const Basic: Story = {
  args: {
    directory: '/home/user/project',
    repositoryKey: 'my-repo',
    isVisible: true,
  },
  render: (args) => {
    useEffect(() => {
      // Add some content to make it more interesting
      const initContent = async () => {
        const sessions = await MockTerminalService.list();
        if (sessions.length > 0) {
          MockTerminalService.addContent(
            sessions[0].id,
            '$ npm start\r\nStarting server...\r\n\x1b[32mServer running on port 3000\x1b[0m\r\n$ ',
          );
        }
      };

      setTimeout(initContent, 500);
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <MultiTerminalPanel {...args} />
      </div>
    );
  },
};

/**
 * Multi-terminal with multiple tabs
 */
export const MultipleTabs: Story = {
  render: () => {
    useEffect(() => {
      const initSessions = async () => {
        // Clear existing
        const existing = await MockTerminalService.list();
        for (const session of existing) {
          await MockTerminalService.destroy(session.id);
        }

        // Create multiple sessions
        const session1 = await MockTerminalService.create(
          '/home/user/project',
          'terminal:demo',
        );
        MockTerminalService.addContent(
          session1,
          '$ npm run dev\r\nDev server running...\r\n$ ',
        );

        const session2 = await MockTerminalService.create(
          '/home/user/project',
          'terminal:demo',
        );
        MockTerminalService.addContent(
          session2,
          '$ git status\r\nOn branch main\r\n$ ',
        );

        const session3 = await MockTerminalService.create(
          '/home/user/project',
          'terminal:demo',
        );
        MockTerminalService.addContent(
          session3,
          '$ npm test\r\nRunning tests...\r\n$ ',
        );
      };

      initSessions();
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <MultiTerminalPanel
          directory="/home/user/project"
          repositoryKey="demo"
          isVisible={true}
        />
      </div>
    );
  },
};
