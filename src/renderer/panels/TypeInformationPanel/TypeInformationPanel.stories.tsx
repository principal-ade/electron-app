import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import { TypeInformationPanel } from './TypeInformationPanel';

// Mock event emitter
class MockEventEmitter implements PanelEventEmitter {
  private listeners: Map<string, Array<(event: any) => void>> = new Map();

  emit(event: any): void {
    console.log('[Mock Event]:', event);
    const eventListeners = this.listeners.get(event.type) || [];
    eventListeners.forEach((listener) => listener(event));
  }

  on(eventType: string, handler: (event: any) => void): () => void {
    const listeners = this.listeners.get(eventType) || [];
    listeners.push(handler);
    this.listeners.set(eventType, listeners);

    // Return unsubscribe function
    return () => {
      const currentListeners = this.listeners.get(eventType) || [];
      const index = currentListeners.indexOf(handler);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  off(eventType: string, handler: (event: any) => void): void {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(handler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

// Mock types data generator
const createMockTypes = (count: number = 20) => {
  const kinds: Array<'interface' | 'type' | 'class' | 'enum' | 'function'> = [
    'interface',
    'type',
    'class',
    'enum',
    'function',
  ];

  const typeNames = [
    'UserProfile',
    'ApiResponse',
    'Repository',
    'GitStatus',
    'PanelContextValue',
    'ThemeColors',
    'ValidationError',
    'formatDate',
    'ComponentProps',
    'ServiceConfig',
    'HttpClient',
    'DatabaseConnection',
    'AuthToken',
    'ErrorHandler',
    'Logger',
    'RouteConfig',
    'Middleware',
    'RequestHandler',
    'ResponseData',
    'QueryParams',
    'FileMetadata',
    'CacheEntry',
    'EventEmitter',
    'StreamProcessor',
    'DataTransformer',
  ];

  const files = [
    'src/types/user.ts',
    'src/types/api.ts',
    'src/types/repository.ts',
    'src/types/git.ts',
    'src/types/panel.ts',
    'src/types/theme.ts',
    'src/utils/errors.ts',
    'src/utils/date.ts',
    'src/components/Button.tsx',
    'src/services/api-client.ts',
    'src/services/auth.ts',
    'src/config/routes.ts',
    'src/middleware/logger.ts',
    'src/models/user.ts',
    'src/lib/cache.ts',
  ];

  return Array.from({ length: Math.min(count, typeNames.length) }, (_, i) => ({
    name: typeNames[i],
    kind: kinds[i % kinds.length],
    filePath: files[i % files.length],
  }));
};

// Mock context provider component
const MockTypeInformationPanel: React.FC<{
  hasRepository?: boolean;
  typeCount?: number;
}> = ({ hasRepository = true, typeCount = 20 }) => {
  const [mockTypes] = useState(createMockTypes(typeCount));

  const mockContext: PanelContextValue = {
    currentScope: hasRepository
      ? {
          type: 'repository',
          repository: {
            path: '/mock-repo',
            name: 'mock-project',
          },
        }
      : undefined,
    getSlice: () => ({
      data: mockTypes,
      loading: false,
      error: undefined,
      refresh: async () => {},
    }),
    hasSlice: () => true,
    isSliceLoading: () => false,
    refresh: async () => {},
    clearSlice: () => {},
  } as any;

  const mockActions: PanelActions = {
    openFile: async () => {},
    openRepository: async () => {},
  } as any;

  const mockEvents = new MockEventEmitter();

  return (
    <TypeInformationPanel
      context={mockContext}
      actions={mockActions}
      events={mockEvents}
    />
  );
};

// Wrapper with theme provider
const TypeInformationPanelStory: React.FC<{
  hasRepository?: boolean;
  typeCount?: number;
}> = (props) => {
  return (
    <ThemeProvider>
      <MockTypeInformationPanel {...props} />
    </ThemeProvider>
  );
};

const meta = {
  title: 'Panels/TypeInformationPanel',
  component: TypeInformationPanel,
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
} satisfies Meta<typeof TypeInformationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with types
export const Default = {
  render: () => <TypeInformationPanelStory />,
} as unknown as Story;

// Empty state - no repository
export const NoRepository = {
  render: () => <TypeInformationPanelStory hasRepository={false} />,
} as unknown as Story;

// Few types
export const FewTypes = {
  render: () => <TypeInformationPanelStory typeCount={5} />,
} as unknown as Story;

// Many types (scrolling)
export const ManyTypes = {
  render: () => <TypeInformationPanelStory typeCount={25} />,
} as unknown as Story;

// Loading state
export const LoadingState = {
  render: () => {
    const LoadingPanel: React.FC = () => {
      const mockContext: PanelContextValue = {
        currentScope: {
          type: 'repository',
          repository: {
            path: '/mock-repo',
            name: 'loading-project',
          },
        },
        getSlice: () => ({
          data: undefined,
          loading: true,
          error: undefined,
          refresh: async () => {},
        }),
        hasSlice: () => true,
        isSliceLoading: () => true,
        refresh: async () => {},
        clearSlice: () => {},
      } as any;

      const mockActions: PanelActions = {} as any;
      const mockEvents = new MockEventEmitter();

      return (
        <ThemeProvider>
          <TypeInformationPanel
            context={mockContext}
            actions={mockActions}
            events={mockEvents}
          />
        </ThemeProvider>
      );
    };

    return <LoadingPanel />;
  },
} as unknown as Story;

// Interactive demo with controls
export const Interactive = {
  render: () => {
    const InteractivePanel: React.FC = () => {
      const [hasRepository, setHasRepository] = useState(true);
      const [typeCount, setTypeCount] = useState(15);

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
              flexShrink: 0,
            }}
          >
            <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={hasRepository}
                onChange={(e) => setHasRepository(e.target.checked)}
              />
              Has Repository
            </label>
            <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Type Count:
              <input
                type="number"
                value={typeCount}
                onChange={(e) => setTypeCount(parseInt(e.target.value) || 0)}
                min={0}
                max={25}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  color: '#fff',
                  width: '80px',
                }}
              />
            </label>
          </div>

          {/* Panel */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TypeInformationPanelStory
              hasRepository={hasRepository}
              typeCount={typeCount}
            />
          </div>
        </div>
      );
    };

    return <InteractivePanel />;
  },
} as unknown as Story;
