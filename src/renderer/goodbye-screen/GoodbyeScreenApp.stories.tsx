import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { useState, useEffect } from 'react';
import { GoodbyeScreenApp } from './GoodbyeScreenApp';
import './goodbye-screen.css';

interface GoodbyeScreenData {
  newVersion: string;
}

type DataListener = (data: GoodbyeScreenData) => void;

// Mock electronAPI for Storybook
class MockElectronAPI {
  private listeners: DataListener[] = [];
  private data: GoodbyeScreenData = { newVersion: '2.0.0' };

  onData(callback: DataListener) {
    this.listeners.push(callback);
    // Immediately send current data
    callback(this.data);
    // Return cleanup function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  signalAnimationComplete() {
    console.info('[MockElectronAPI] Animation complete signal received');
  }

  requestData() {
    this.listeners.forEach((listener) => {
      listener(this.data);
    });
  }

  setVersion(version: string) {
    this.data = { newVersion: version };
    this.listeners.forEach((listener) => {
      listener(this.data);
    });
  }
}

type ElectronAPI = NonNullable<Window['electronAPI']>;

let storybookElectronAPI: MockElectronAPI | undefined;

// Install mock electronAPI
if (typeof window !== 'undefined') {
  storybookElectronAPI = new MockElectronAPI();
  window.electronAPI = storybookElectronAPI as unknown as ElectronAPI;
}

const meta = {
  title: 'Screens/GoodbyeScreen',
  component: GoodbyeScreenApp,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'transparent',
      values: [
        { name: 'transparent', value: 'transparent' },
        { name: 'dark', value: '#1a1a1a' },
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
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GoodbyeScreenApp>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default goodbye screen with version 2.0.0.
 * This shows the full animation sequence.
 */
export const Default: Story = {
  render: () => {
    return <GoodbyeScreenApp />;
  },
};

/**
 * Goodbye screen with a specific version number.
 */
export const WithVersion: Story = {
  render: () => {
    useEffect(() => {
      storybookElectronAPI?.setVersion('3.1.4');
    }, []);
    return <GoodbyeScreenApp />;
  },
};

/**
 * Goodbye screen with a long version string.
 */
export const LongVersion: Story = {
  render: () => {
    useEffect(() => {
      storybookElectronAPI?.setVersion('1.2.3-beta.4+build.5678');
    }, []);
    return <GoodbyeScreenApp />;
  },
};

/**
 * Interactive demo with animation controls.
 */
export const AnimationDemo: Story = {
  render: () => {
    const [key, setKey] = useState(0);

    const handleReplay = () => {
      setKey((prev) => prev + 1);
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
            zIndex: 10000,
          }}
        >
          <button
            onClick={handleReplay}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Replay Animation
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
            zIndex: 10000,
          }}
        >
          <strong style={{ color: '#fff' }}>Animation Phases:</strong>
          <div style={{ marginTop: '8px' }}>
            <span style={{ color: '#22c55e' }}>Enter</span> (0-0.3s) →{' '}
            <span style={{ color: '#3b82f6' }}>Display</span> (0.3-2s) →{' '}
            <span style={{ color: '#ef4444' }}>Exit</span> (2-2.5s) →{' '}
            <span style={{ color: '#f59e0b' }}>Complete</span>
          </div>
        </div>

        {/* Goodbye Screen */}
        <GoodbyeScreenApp key={key} />
      </div>
    );
  },
};

/**
 * Static view of the goodbye screen (no animation).
 * Useful for design iteration.
 */
export const StaticView: Story = {
  render: () => {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Logo/Icon placeholder */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '24px',
              backgroundColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 60px rgba(99, 102, 241, 0.4)',
            }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>

          {/* Main message */}
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 600,
                margin: 0,
                marginBottom: '8px',
              }}
            >
              Installing Update
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.6)',
                margin: 0,
              }}
            >
              Updating to version 2.0.0
            </p>
          </div>

          {/* Loading indicator */}
          <div
            style={{
              width: '200px',
              height: '4px',
              backgroundColor: 'rgba(99, 102, 241, 0.3)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginTop: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#6366f1',
                borderRadius: '2px',
                animation: 'goodbyeProgress 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>
    );
  },
};
