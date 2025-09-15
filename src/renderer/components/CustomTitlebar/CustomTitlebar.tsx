import React, { useEffect, useState } from 'react';
import './CustomTitlebar.css';

declare global {
  interface Window {
    electronTitlebar?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
    };
  }
}

// Use the simple custom titlebar implementation instead of the library
export const CustomTitlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    if (window.electronTitlebar) {
      // Check initial maximized state
      window.electronTitlebar.isMaximized().then(setIsMaximized);

      // Listen for maximize state changes
      window.electronTitlebar.onMaximizeChange(setIsMaximized);
    }
  }, []);

  if (!window.electronTitlebar) {
    return null; // Not in Electron environment
  }

  return (
    <div className="custom-titlebar">
      <div className="titlebar-drag-region">
        <div className="titlebar-title">PrincipleMD</div>
      </div>
      {!isMac && (
        <div className="titlebar-controls">
          <button
            className="titlebar-button minimize"
            onClick={() => window.electronTitlebar?.minimize()}
            aria-label="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect fill="currentColor" width="10" height="1" />
            </svg>
          </button>
          <button
            className="titlebar-button maximize"
            onClick={() => window.electronTitlebar?.maximize()}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  fill="currentColor"
                  d="M2 0v2H0v8h8V8h2V0H2zm1 3h4v4H1V3h2zm4 1H3v3h4V4z"
                />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect fill="currentColor" width="10" height="10" strokeWidth="1" stroke="currentColor" />
              </svg>
            )}
          </button>
          <button
            className="titlebar-button close"
            onClick={() => window.electronTitlebar?.close()}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                fill="currentColor"
                d="M1.41 0L5 3.59 8.59 0 10 1.41 6.41 5 10 8.59 8.59 10 5 6.41 1.41 10 0 8.59 3.59 5 0 1.41 1.41 0z"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

// Alternative simple custom titlebar without the library
export const SimpleCustomTitlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    if (window.electronTitlebar) {
      // Check initial maximized state
      window.electronTitlebar.isMaximized().then(setIsMaximized);

      // Listen for maximize state changes
      window.electronTitlebar.onMaximizeChange(setIsMaximized);
    }
  }, []);

  if (!window.electronTitlebar) {
    return null; // Not in Electron environment
  }

  return (
    <div className="custom-titlebar">
      <div className="titlebar-drag-region">
        <div className="titlebar-title">PrincipleMD</div>
      </div>
      {!isMac && (
        <div className="titlebar-controls">
          <button
            className="titlebar-button minimize"
            onClick={() => window.electronTitlebar.minimize()}
            aria-label="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect fill="currentColor" width="10" height="1" />
            </svg>
          </button>
          <button
            className="titlebar-button maximize"
            onClick={() => window.electronTitlebar.maximize()}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  fill="currentColor"
                  d="M2 0v2H0v8h8V8h2V0H2zm1 3h4v4H1V3h2zm4 1H3v3h4V4z"
                />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect fill="currentColor" width="10" height="10" strokeWidth="1" stroke="currentColor" />
              </svg>
            )}
          </button>
          <button
            className="titlebar-button close"
            onClick={() => window.electronTitlebar.close()}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                fill="currentColor"
                d="M1.41 0L5 3.59 8.59 0 10 1.41 6.41 5 10 8.59 8.59 10 5 6.41 1.41 10 0 8.59 3.59 5 0 1.41 1.41 0z"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};