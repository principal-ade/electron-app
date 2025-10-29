import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { WindowSwitcherApp } from './WindowSwitcherApp';
import './window-switcher.css';

// Mock window list data
const mockWindows = [
  { id: 1, title: 'Main' },
  { id: 2, title: 'electron-app' },
  { id: 3, title: 'code-city-react' },
  { id: 4, title: 'agent-monitoring-ui' },
];

// Mock electronAPI for Storybook
class MockElectronAPI {
  private listeners: {
    windowListUpdate: Array<(data: any) => void>;
    selectNext: Array<() => void>;
    selectPrevious: Array<() => void>;
  } = {
    windowListUpdate: [],
    selectNext: [],
    selectPrevious: [],
  };

  private selectedIndex = 0;
  private windows = mockWindows;

  onWindowListUpdate(callback: (data: any) => void) {
    this.listeners.windowListUpdate.push(callback);
    // Immediately send current state
    callback({
      windows: this.windows,
      selectedIndex: this.selectedIndex,
    });
    // Return cleanup function
    return () => {
      const index = this.listeners.windowListUpdate.indexOf(callback);
      if (index > -1) {
        this.listeners.windowListUpdate.splice(index, 1);
      }
    };
  }

  onSelectNext(callback: () => void) {
    this.listeners.selectNext.push(callback);
    return () => {
      const index = this.listeners.selectNext.indexOf(callback);
      if (index > -1) {
        this.listeners.selectNext.splice(index, 1);
      }
    };
  }

  onSelectPrevious(callback: () => void) {
    this.listeners.selectPrevious.push(callback);
    return () => {
      const index = this.listeners.selectPrevious.indexOf(callback);
      if (index > -1) {
        this.listeners.selectPrevious.splice(index, 1);
      }
    };
  }

  getWindowList() {
    // Send current list to all listeners
    this.listeners.windowListUpdate.forEach((listener) => {
      listener({
        windows: this.windows,
        selectedIndex: this.selectedIndex,
      });
    });
  }

  cycleSelection(direction: 'next' | 'previous') {
    if (direction === 'next') {
      this.selectedIndex = (this.selectedIndex + 1) % this.windows.length;
      this.listeners.selectNext.forEach((listener) => listener());
    } else {
      this.selectedIndex =
        (this.selectedIndex - 1 + this.windows.length) % this.windows.length;
      this.listeners.selectPrevious.forEach((listener) => listener());
    }

    // Update all window list listeners
    this.listeners.windowListUpdate.forEach((listener) => {
      listener({
        windows: this.windows,
        selectedIndex: this.selectedIndex,
      });
    });
  }

  selectWindow(windowId: number) {
    console.log(`Selected window: ${windowId}`);
    const window = this.windows.find((w) => w.id === windowId);
    if (window) {
      console.log(`Switching to: ${window.title}`);
    }
  }

  setWindows(windows: typeof mockWindows) {
    this.windows = windows;
    this.selectedIndex = 0;
    this.getWindowList();
  }
}

// Install mock electronAPI
if (typeof window !== 'undefined') {
  (window as any).electronAPI = new MockElectronAPI();
}

const meta = {
  title: 'Components/WindowSwitcherApp',
  component: WindowSwitcherApp,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#000000' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.5)',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WindowSwitcherApp>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default window switcher with 4 windows.
 * This simulates the typical Command+; overlay.
 */
export const Default: Story = {
  render: () => {
    return <WindowSwitcherApp />;
  },
};

/**
 * Window switcher with only 2 windows.
 */
export const TwoWindows: Story = {
  render: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setWindows([
        { id: 1, title: 'Main' },
        { id: 2, title: 'electron-app' },
      ]);
    }
    return <WindowSwitcherApp />;
  },
};

/**
 * Window switcher with many windows.
 */
export const ManyWindows: Story = {
  render: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setWindows([
        { id: 1, title: 'Main' },
        { id: 2, title: 'electron-app' },
        { id: 3, title: 'code-city-react' },
        { id: 4, title: 'agent-monitoring-ui' },
        { id: 5, title: 'dynamic-file-tree' },
        { id: 6, title: 'principal-ai-mcp' },
        { id: 7, title: 'storybook' },
        { id: 8, title: 'documentation' },
      ]);
    }
    return <WindowSwitcherApp />;
  },
};

/**
 * Window switcher with long titles.
 */
export const LongTitles: Story = {
  render: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setWindows([
        { id: 1, title: 'Main Application Window' },
        {
          id: 2,
          title: 'electron-app-with-very-long-repository-name',
        },
        { id: 3, title: 'another-extremely-long-window-title-example' },
        { id: 4, title: 'Short' },
      ]);
    }
    return <WindowSwitcherApp />;
  },
};

/**
 * Interactive demo with controls to test cycling behavior.
 */
export const InteractiveDemo: Story = {
  render: () => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const handleNext = () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        (window as any).electronAPI.cycleSelection('next');
        setSelectedIndex((prev) => (prev + 1) % mockWindows.length);
      }
    };

    const handlePrevious = () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        (window as any).electronAPI.cycleSelection('previous');
        setSelectedIndex(
          (prev) => (prev - 1 + mockWindows.length) % mockWindows.length,
        );
      }
    };

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        {/* Control Panel */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '12px',
            padding: '16px',
            background: 'rgba(30, 30, 30, 0.9)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button
            onClick={handlePrevious}
            style={{
              padding: '10px 20px',
              backgroundColor: '#444',
              color: '#fff',
              border: '1px solid #666',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            ← Previous (Shift+;)
          </button>

          <div
            style={{
              padding: '10px 20px',
              color: '#6495ed',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Selected: {selectedIndex + 1} / {mockWindows.length}
          </div>

          <button
            onClick={handleNext}
            style={{
              padding: '10px 20px',
              backgroundColor: '#444',
              color: '#fff',
              border: '1px solid #666',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Next (;) →
          </button>
        </div>

        {/* Instructions */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '16px',
            background: 'rgba(30, 30, 30, 0.9)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '12px',
            maxWidth: '600px',
            textAlign: 'center',
          }}
        >
          <strong style={{ color: '#fff' }}>Testing Instructions:</strong>
          <div style={{ marginTop: '8px' }}>
            Press <kbd style={{ padding: '2px 6px', background: '#555', borderRadius: '3px' }}>;</kbd> to cycle forward or{' '}
            <kbd style={{ padding: '2px 6px', background: '#555', borderRadius: '3px' }}>Shift+;</kbd> to cycle backward.
            Click any window card to select it. Use the buttons above to simulate keyboard shortcuts.
          </div>
        </div>

        {/* Window Switcher */}
        <WindowSwitcherApp />
      </div>
    );
  },
};

/**
 * Empty state with no windows available.
 */
export const EmptyState: Story = {
  render: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setWindows([]);
    }
    return <WindowSwitcherApp />;
  },
};

/**
 * Single window (switcher typically doesn't show for single window,
 * but this demonstrates the UI if it did).
 */
export const SingleWindow: Story = {
  render: () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setWindows([{ id: 1, title: 'Main' }]);
    }
    return <WindowSwitcherApp />;
  },
};
