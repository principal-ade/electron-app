import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelComponentProps,
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
  PanelEventType,
  DataSlice,
} from '../types';

/**
 * Mock Git Status data for Storybook
 */
const mockGitStatusData = {
  staged: ['src/components/Button.tsx', 'src/styles/theme.css'],
  unstaged: ['README.md', 'package.json'],
  untracked: ['src/new-feature.tsx'],
  deleted: [],
};

/**
 * Create a mock DataSlice
 */
const createMockSlice = <T,>(
  name: string,
  data: T,
  scope: 'workspace' | 'repository' | 'global' = 'repository'
): DataSlice<T> => ({
  scope,
  name,
  data,
  loading: false,
  error: null,
  refresh: async () => {
    // eslint-disable-next-line no-console
    console.log(`[Mock] Refreshing slice: ${name}`);
  },
});

/**
 * Mock Panel Context for Storybook
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createMockContext = (overrides?: any): any => {
  // Create mock data slices
  const mockSlices = new Map<string, DataSlice>([
    ['git', createMockSlice('git', mockGitStatusData)],
    [
      'markdown',
      createMockSlice('markdown', [
        {
          path: 'README.md',
          title: 'Project README',
          lastModified: Date.now() - 3600000,
        },
        {
          path: 'docs/API.md',
          title: 'API Documentation',
          lastModified: Date.now() - 86400000,
        },
      ]),
    ],
    [
      'fileTree',
      createMockSlice('fileTree', {
        name: 'my-project',
        path: '/Users/developer/my-project',
        type: 'directory',
        children: [
          {
            name: 'src',
            path: '/Users/developer/my-project/src',
            type: 'directory',
          },
          {
            name: 'package.json',
            path: '/Users/developer/my-project/package.json',
            type: 'file',
          },
        ],
      }),
    ],
    [
      'packages',
      createMockSlice('packages', [
        { name: 'react', version: '19.0.0', path: '/node_modules/react' },
        {
          name: 'typescript',
          version: '5.0.4',
          path: '/node_modules/typescript',
        },
      ]),
    ],
    [
      'quality',
      createMockSlice('quality', {
        coverage: 85,
        issues: 3,
        complexity: 12,
      }),
    ],
  ]);

  const defaultContext: PanelContextValue = {
    currentScope: {
      type: 'repository',
      workspace: {
        name: 'my-workspace',
        path: '/Users/developer/my-workspace',
      },
      repository: {
        name: 'my-project',
        path: '/Users/developer/my-project',
      },
    },
    refresh: async (
      scope?: 'workspace' | 'repository',
      slice?: string
    ): Promise<void> => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Context refresh called', { scope, slice });
    },
  };

  const merged = { ...defaultContext, ...overrides };

  // Spread slices as direct properties for typed panel contexts
  // (e.g., context.fileTree, context.globalSkills, etc.)
  // Only set default slices if not already provided by overrides
  mockSlices.forEach((slice: DataSlice, name: string) => {
    if (!(name in merged)) {
      merged[name] = slice;
    }
  });

  return merged;
};

/**
 * Mock Panel Actions for Storybook
 */
export const createMockActions = (
  overrides?: Partial<PanelActions>
): PanelActions => ({
  openFile: (filePath: string) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Opening file:', filePath);
  },
  openGitDiff: (filePath: string, status) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Opening git diff:', filePath, status);
  },
  navigateToPanel: (panelId: string) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Navigating to panel:', panelId);
  },
  notifyPanels: (event) => {
    // eslint-disable-next-line no-console
    console.log('[Mock] Notifying panels:', event);
  },
  ...overrides,
});

/**
 * Mock Event Emitter for Storybook
 */
export const createMockEvents = (): PanelEventEmitter => {
  const handlers = new Map<
    PanelEventType,
    Set<(event: PanelEvent<unknown>) => void>
  >();

  return {
    emit: (event) => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Emitting event:', event);
      const eventHandlers = handlers.get(event.type);
      if (eventHandlers) {
        eventHandlers.forEach((handler) => handler(event));
      }
    },
    on: (type, handler) => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Subscribing to event:', type);
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      handlers.get(type)!.add(handler as (event: PanelEvent<unknown>) => void);

      // Return cleanup function
      return () => {
        // eslint-disable-next-line no-console
        console.log('[Mock] Unsubscribing from event:', type);
        handlers
          .get(type)
          ?.delete(handler as (event: PanelEvent<unknown>) => void);
      };
    },
    off: (type, handler) => {
      // eslint-disable-next-line no-console
      console.log('[Mock] Removing event handler:', type);
      handlers
        .get(type)
        ?.delete(handler as (event: PanelEvent<unknown>) => void);
    },
  };
};

/**
 * Mock Panel Props Provider
 * Wraps components with mock context and ThemeProvider for Storybook
 */
export const MockPanelProvider: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: React.ReactNode | ((props: PanelComponentProps<any, any>) => React.ReactNode);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextOverrides?: any;
  actionsOverrides?: Partial<PanelActions>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockSlices?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockAdapters?: any;
}> = ({ children, contextOverrides, actionsOverrides, mockSlices, mockAdapters }) => {
  // Convert mockSlices from plain object to direct slice properties
  const sliceOverrides: Record<string, DataSlice> = {};
  if (mockSlices) {
    Object.entries(mockSlices).forEach(([name, data]) => {
      sliceOverrides[name] = createMockSlice(name, data);
    });
  }

  // Merge mockSlices and mockAdapters into contextOverrides
  const mergedContextOverrides = {
    ...contextOverrides,
    ...sliceOverrides,
    ...(mockAdapters && { adapters: mockAdapters }),
  };

  // eslint-disable-next-line no-console
  console.log('[MockPanelProvider] contextOverrides:', mergedContextOverrides);
  const context = createMockContext(mergedContextOverrides);
  // eslint-disable-next-line no-console
  console.log('[MockPanelProvider] created context:', context);
  // eslint-disable-next-line no-console
  console.log('[MockPanelProvider] context.adapters:', context.adapters);
  const actions = createMockActions(actionsOverrides);
  const events = createMockEvents();

  // Support both render prop pattern and regular children
  const content = typeof children === 'function'
    ? children({ context, actions, events })
    : children;

  return <ThemeProvider>{content}</ThemeProvider>;
};
