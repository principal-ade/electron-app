import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { useState, useEffect } from 'react';
import { SplashScreenApp } from './SplashScreenApp';
import './splash-screen.css';

interface SplashScreenData {
  isPostUpdate: boolean;
  currentVersion: string;
  previousVersion: string | null;
}

type DataListener = (data: SplashScreenData) => void;
type CloseListener = () => void;

// Mock electronAPI for Storybook
class MockElectronAPI {
  private dataListeners: DataListener[] = [];
  private closeListeners: CloseListener[] = [];
  private data: SplashScreenData = {
    isPostUpdate: false,
    currentVersion: '1.0.0',
    previousVersion: null,
  };

  onData(callback: DataListener) {
    this.dataListeners.push(callback);
    // Immediately send current data
    callback(this.data);
    // Return cleanup function
    return () => {
      const index = this.dataListeners.indexOf(callback);
      if (index > -1) {
        this.dataListeners.splice(index, 1);
      }
    };
  }

  onClose(callback: CloseListener) {
    this.closeListeners.push(callback);
    return () => {
      const index = this.closeListeners.indexOf(callback);
      if (index > -1) {
        this.closeListeners.splice(index, 1);
      }
    };
  }

  requestData() {
    this.dataListeners.forEach((listener) => {
      listener(this.data);
    });
  }

  // Helper methods for stories
  setData(newData: SplashScreenData) {
    this.data = newData;
    this.dataListeners.forEach((listener) => {
      listener(this.data);
    });
  }

  triggerClose() {
    this.closeListeners.forEach((listener) => {
      listener();
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
  title: 'Screens/SplashScreen',
  component: SplashScreenApp,
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
} satisfies Meta<typeof SplashScreenApp>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default splash screen - normal startup, not a post-update.
 */
export const Default: Story = {
  render: () => {
    useEffect(() => {
      storybookElectronAPI?.setData({
        isPostUpdate: false,
        currentVersion: '1.0.0',
        previousVersion: null,
      });
    }, []);
    return <SplashScreenApp />;
  },
};

/**
 * Post-update splash screen - shows the version update message.
 */
export const PostUpdate: Story = {
  render: () => {
    useEffect(() => {
      storybookElectronAPI?.setData({
        isPostUpdate: true,
        currentVersion: '2.0.0',
        previousVersion: '1.9.0',
      });
    }, []);
    return <SplashScreenApp />;
  },
};

/**
 * Major version update.
 */
export const MajorUpdate: Story = {
  render: () => {
    useEffect(() => {
      storybookElectronAPI?.setData({
        isPostUpdate: true,
        currentVersion: '3.0.0',
        previousVersion: '2.5.1',
      });
    }, []);
    return <SplashScreenApp />;
  },
};

/**
 * Interactive demo with close animation.
 */
export const InteractiveDemo: Story = {
  render: () => {
    const [key, setKey] = useState(0);

    const handleReset = () => {
      setKey((prev) => prev + 1);
      // Reset to default state after a small delay
      setTimeout(() => {
        storybookElectronAPI?.setData({
          isPostUpdate: true,
          currentVersion: '2.0.0',
          previousVersion: '1.9.0',
        });
      }, 100);
    };

    const handleClose = () => {
      storybookElectronAPI?.triggerClose();
    };

    useEffect(() => {
      storybookElectronAPI?.setData({
        isPostUpdate: true,
        currentVersion: '2.0.0',
        previousVersion: '1.9.0',
      });
    }, [key]);

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
            onClick={handleReset}
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
            Reset Animation
          </button>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Trigger Close
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
          <strong style={{ color: '#fff' }}>Splash Screen:</strong>
          <div style={{ marginTop: '8px' }}>
            The splash screen shows on app startup. When it's a post-update, it
            displays the new version. Click "Trigger Close" to see the fade-out
            animation.
          </div>
        </div>

        {/* Splash Screen */}
        <SplashScreenApp key={key} />
      </div>
    );
  },
};

/**
 * Static view of the splash screen (no animation).
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
            gap: '20px',
          }}
        >
          {/* Logo/Icon placeholder */}
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '20px',
              backgroundColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 40px rgba(99, 102, 241, 0.4)',
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>

          {/* Main message */}
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 600,
                margin: 0,
                marginBottom: '4px',
              }}
            >
              Updated to v2.0.0
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
                margin: 0,
              }}
            >
              from v1.9.0
            </p>
          </div>

          {/* Loading dots */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                  animation: `splashDot 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
};
