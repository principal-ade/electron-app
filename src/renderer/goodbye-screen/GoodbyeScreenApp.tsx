import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

interface GoodbyeScreenData {
  newVersion: string;
}

// Type for the electronAPI exposed by preload
interface GoodbyeElectronAPI {
  signalAnimationComplete: () => void;
  onData: (callback: (data: GoodbyeScreenData) => void) => () => void;
  requestData: () => void;
}

// Helper to get typed electronAPI
const getElectronAPI = (): GoodbyeElectronAPI | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).electronAPI as GoodbyeElectronAPI | undefined;
};

// Default animation duration in ms
const ANIMATION_DURATION = 2500;

export const GoodbyeScreenApp: React.FC = () => {
  const { theme } = useTheme();
  const [data, setData] = useState<GoodbyeScreenData | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'enter' | 'display' | 'exit'>('enter');

  // Handle animation completion
  const onAnimationComplete = useCallback(() => {
    const api = getElectronAPI();
    if (api) {
      api.signalAnimationComplete();
    }
  }, []);

  // Listen for data from main process
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) {
      console.warn('[GoodbyeScreen] electronAPI not available');
      return;
    }

    const cleanup = api.onData((receivedData: GoodbyeScreenData) => {
      console.info('[GoodbyeScreen] Received data:', receivedData);
      setData(receivedData);
    });

    // Request data in case we missed the initial send
    api.requestData();

    return cleanup;
  }, []);

  // Animation sequence
  useEffect(() => {
    // Enter animation
    const enterTimeout = setTimeout(() => {
      setAnimationPhase('display');
    }, 300);

    // Display phase
    const displayTimeout = setTimeout(() => {
      setAnimationPhase('exit');
    }, ANIMATION_DURATION - 500);

    // Signal completion
    const completeTimeout = setTimeout(() => {
      onAnimationComplete();
    }, ANIMATION_DURATION);

    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(displayTimeout);
      clearTimeout(completeTimeout);
    };
  }, [onAnimationComplete]);

  const getAnimationStyles = (): React.CSSProperties => {
    switch (animationPhase) {
      case 'enter':
        return {
          opacity: 0,
          transform: 'scale(0.9)',
        };
      case 'display':
        return {
          opacity: 1,
          transform: 'scale(1)',
        };
      case 'exit':
        return {
          opacity: 0,
          transform: 'scale(1.1)',
        };
    }
  };

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
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          ...getAnimationStyles(),
        }}
      >
        {/* Logo/Icon placeholder - replace with actual logo */}
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '24px',
            backgroundColor: theme.colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 60px ${theme.colors.primary}40`,
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
        <div
          style={{
            textAlign: 'center',
            color: theme.colors.text,
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              margin: 0,
              marginBottom: '8px',
              fontFamily: theme.fonts.body,
            }}
          >
            Installing Update
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: theme.colors.textSecondary,
              margin: 0,
              fontFamily: theme.fonts.body,
            }}
          >
            {data?.newVersion
              ? `Updating to version ${data.newVersion}`
              : 'See you in a moment...'}
          </p>
        </div>

        {/* Loading indicator */}
        <div
          style={{
            width: '200px',
            height: '4px',
            backgroundColor: `${theme.colors.primary}30`,
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: theme.colors.primary,
              borderRadius: '2px',
              animation: 'goodbyeProgress 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default GoodbyeScreenApp;
