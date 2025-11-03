import React, { useEffect, useRef, useState } from 'react';

type SwitcherWindow = {
  id: number;
  title: string;
  thumbnail?: string;
};

type WindowListPayload = {
  windows?: SwitcherWindow[];
  selectedIndex?: number;
};

function normalizeIndex(index: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  const normalized = ((index % total) + total) % total;
  return normalized;
}

export const WindowSwitcherApp: React.FC = () => {
  const [windows, setWindows] = useState<SwitcherWindow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const windowsRef = useRef<SwitcherWindow[]>(windows);
  const electronAPI =
    typeof window !== 'undefined' ? window.electronAPI : undefined;

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    if (!electronAPI) {
      return;
    }

    const cleanupFns: Array<() => void> = [];

    const unsubscribeList = electronAPI.onWindowListUpdate?.(
      (data: WindowListPayload) => {
        const nextWindows = data?.windows ?? [];
        setWindows(nextWindows);

        if (typeof data?.selectedIndex === 'number') {
          setSelectedIndex(
            normalizeIndex(data.selectedIndex, nextWindows.length),
          );
        } else if (nextWindows.length === 0) {
          setSelectedIndex(0);
        }
      },
    );

    if (typeof unsubscribeList === 'function') {
      cleanupFns.push(unsubscribeList);
    }

    const unsubscribeNext = electronAPI.onSelectNext?.(() => {
      setSelectedIndex((current) => {
        const total = windowsRef.current.length;
        if (total === 0) {
          return current;
        }
        return normalizeIndex(current + 1, total);
      });
    });

    if (typeof unsubscribeNext === 'function') {
      cleanupFns.push(unsubscribeNext);
    }

    const unsubscribePrevious = electronAPI.onSelectPrevious?.(() => {
      setSelectedIndex((current) => {
        const total = windowsRef.current.length;
        if (total === 0) {
          return current;
        }
        return normalizeIndex(current - 1, total);
      });
    });

    if (typeof unsubscribePrevious === 'function') {
      cleanupFns.push(unsubscribePrevious);
    }

    electronAPI.getWindowList?.();

    return () => {
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.warn('Failed to cleanup window switcher listener', error);
        }
      });
    };
  }, [electronAPI]);

  useEffect(() => {
    if (!electronAPI) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape key closes the switcher
      if (event.key === 'Escape') {
        event.preventDefault();
        window.close();
        return;
      }

      // Arrow keys for navigation
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        electronAPI.cycleSelection?.('next');
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        electronAPI.cycleSelection?.('previous');
        return;
      }

      // Enter key to activate selected window
      if (event.key === 'Enter') {
        event.preventDefault();
        const selectedWindow = windows[selectedIndex];
        if (selectedWindow) {
          electronAPI.selectWindow?.(selectedWindow.id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [electronAPI, windows, selectedIndex]);

  const handleTileClick = (index: number) => {
    const target = windows[index];
    if (!target || !electronAPI) {
      return;
    }

    setSelectedIndex(index);
    electronAPI.selectWindow?.(target.id);
  };

  return (
    <div className="switcher-container" role="dialog" aria-modal="true">
      <div className="windows-grid">
        {windows.length === 0 ? (
          <div className="empty-state" role="status">
            No windows available
          </div>
        ) : (
          windows.map((win, index) => {
            const isSelected = index === selectedIndex;
            const title = win.title?.trim() || 'Untitled Window';

            return (
              <button
                key={win.id}
                type="button"
                className={`window-card${isSelected ? ' selected' : ''}`}
                onClick={() => handleTileClick(index)}
              >
                <div className="window-preview">
                  {win.thumbnail ? (
                    <img src={win.thumbnail} alt="" />
                  ) : (
                    <svg
                      className="window-icon"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                  )}
                </div>
                <span className="window-title" title={title}>
                  {title}
                </span>
              </button>
            );
          })
        )}
      </div>
      <p className="hint">
        <strong>⌘'</strong> toggle • <strong>⌘;</strong> cycle (release to
        activate) • <strong>↑↓</strong> navigate • <strong>Enter</strong>{' '}
        activate • <strong>Esc</strong> close
      </p>
    </div>
  );
};
