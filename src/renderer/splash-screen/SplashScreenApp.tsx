import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Logo } from '@principal-ai/logo-component';

// Type for the electronAPI exposed by preload
interface SplashElectronAPI {
  onClose: (callback: () => void) => () => void;
}

// Helper to get typed electronAPI
const getElectronAPI = (): SplashElectronAPI | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).electronAPI as SplashElectronAPI | undefined;
};

export const SplashScreenApp: React.FC = () => {
  const { theme } = useTheme();
  const [isClosing, setIsClosing] = useState(false);
  const [logoSize, setLogoSize] = useState(() => Math.round(window.innerHeight * 0.25));

  // Update logo size on window resize
  useEffect(() => {
    const handleResize = () => {
      setLogoSize(Math.round(window.innerHeight * 0.25));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for close signal from main process
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) {
      console.warn('[SplashScreen] electronAPI not available');
      return;
    }

    const cleanupClose = api.onClose(() => {
      console.info('[SplashScreen] Received close signal');
      setIsClosing(true);
    });

    return () => {
      cleanupClose();
    };
  }, []);

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
        {/* Logo */}
        <Logo width={logoSize} height={logoSize} color={theme.colors.primary} particleColor={theme.colors.text} />

      </div>
    </div>
  );
};

export default SplashScreenApp;
