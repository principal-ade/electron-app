import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

interface SplashScreenData {
  isPostUpdate: boolean;
  currentVersion: string;
  previousVersion: string | null;
}

// Type for the electronAPI exposed by preload
interface SplashElectronAPI {
  onData: (callback: (data: SplashScreenData) => void) => () => void;
  onClose: (callback: () => void) => () => void;
  requestData: () => void;
}

// Helper to get typed electronAPI
const getElectronAPI = (): SplashElectronAPI | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).electronAPI as SplashElectronAPI | undefined;
};

export const SplashScreenApp: React.FC = () => {
  const { theme } = useTheme();
  const [data, setData] = useState<SplashScreenData | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Listen for data from main process
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) {
      console.warn('[SplashScreen] electronAPI not available');
      return;
    }

    const cleanupData = api.onData((receivedData: SplashScreenData) => {
      console.info('[SplashScreen] Received data:', receivedData);
      setData(receivedData);
    });

    const cleanupClose = api.onClose(() => {
      console.info('[SplashScreen] Received close signal');
      setIsClosing(true);
    });

    // Request data in case we missed the initial send
    api.requestData();

    return () => {
      cleanupData();
      cleanupClose();
    };
  }, []);

  const getMessage = useCallback(() => {
    if (!data) {
      return 'Starting...';
    }

    if (data.isPostUpdate && data.previousVersion) {
      return `Updated to v${data.currentVersion}`;
    }

    return 'Starting...';
  }, [data]);

  const getSubMessage = useCallback(() => {
    if (!data) {
      return null;
    }

    if (data.isPostUpdate && data.previousVersion) {
      return `from v${data.previousVersion}`;
    }

    return null;
  }, [data]);

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
        WebkitBackdropFilter: 'blur(20px)',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          animation: 'splashFadeIn 0.5s ease-out',
        }}
      >
        {/* Logo/Icon placeholder - replace with actual logo */}
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '20px',
            backgroundColor: theme.colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 40px ${theme.colors.primary}40`,
            animation: 'splashPulse 2s ease-in-out infinite',
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
        <div
          style={{
            textAlign: 'center',
            color: theme.colors.text,
          }}
        >
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              margin: 0,
              marginBottom: '4px',
              fontFamily: theme.fonts.body,
            }}
          >
            {getMessage()}
          </h1>
          {getSubMessage() && (
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                margin: 0,
                fontFamily: theme.fonts.body,
              }}
            >
              {getSubMessage()}
            </p>
          )}
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
                backgroundColor: theme.colors.primary,
                animation: `splashDot 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SplashScreenApp;
