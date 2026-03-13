import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { motion } from 'framer-motion';
import { LocalProjectCard } from '@industry-theme/repository-composition-panels';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { WindowCard } from './WindowCard';

type SwitcherWindow = {
  id: number;
  title: string;
  primaryType?: string;
  alexandriaEntry?: AlexandriaEntry;
};

type CardPosition = {
  x: number;
  y: number;
  rotate: number;
};

const POSITIONS_STORAGE_KEY = 'window-switcher-card-positions';

// Load saved positions from localStorage
function loadSavedPositions(): Record<number, CardPosition> {
  try {
    const saved = localStorage.getItem(POSITIONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Save positions to localStorage
function savePositions(positions: Record<number, CardPosition>) {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

// Note: WindowListPayload should match the preload's WindowListData
// We use a looser type here to handle potential mismatches gracefully
type WindowListPayload = {
  windows?: Array<{
    id: number;
    title: string;
    primaryType?: string;
    alexandriaEntry?: AlexandriaEntry;
  }>;
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
  const { theme } = useTheme();
  const [windows, setWindows] = useState<SwitcherWindow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draggedCard, setDraggedCard] = useState<number | null>(null);
  const [zIndexOrder, setZIndexOrder] = useState<number[]>([]);
  const [cardPositions, setCardPositions] = useState<Record<number, CardPosition>>(() => loadSavedPositions());
  const tableRef = useRef<HTMLDivElement>(null);

  const windowsRef = useRef<SwitcherWindow[]>(windows);
  const electronAPI =
    typeof window !== 'undefined' ? window.electronAPI : undefined;

  // Initialize z-index order when windows change
  useEffect(() => {
    setZIndexOrder(windows.map((_, i) => i));
  }, [windows.length]);

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

  // Bring card to front when dragging starts
  const bringToFront = (index: number) => {
    setZIndexOrder((prev) => {
      const newOrder = prev.filter((i) => i !== index);
      newOrder.push(index);
      return newOrder;
    });
  };

  // Get z-index for a card based on its position in the order
  const getZIndex = (index: number) => {
    const position = zIndexOrder.indexOf(index);
    return position === -1 ? index : position;
  };

  // Generate initial scattered positions for cards (or use saved position)
  const getInitialPosition = (windowId: number, index: number, total: number): CardPosition => {
    // Check for saved position first
    const savedPosition = cardPositions[windowId];
    if (savedPosition) {
      return savedPosition;
    }

    // Generate new scattered position
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const radius = Math.min(200, total * 30);
    return {
      x: Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      rotate: 0,
    };
  };

  // Save card position after drag
  const handleDragEnd = (windowId: number, info: { offset: { x: number; y: number } }) => {
    setDraggedCard(null);

    // Get the initial position for this card
    const existingPos = cardPositions[windowId];
    const initialPos = existingPos ?? getInitialPosition(windowId, windows.findIndex(w => w.id === windowId), windows.length);

    // Add the drag offset to the initial position
    const newPosition: CardPosition = {
      x: initialPos.x + info.offset.x,
      y: initialPos.y + info.offset.y,
      rotate: initialPos.rotate,
    };

    setCardPositions(prev => {
      const updated = { ...prev, [windowId]: newPosition };
      savePositions(updated);
      return updated;
    });
  };

  // Felt table background with subtle texture
  const feltBackground = `
    radial-gradient(ellipse at center, rgba(30, 80, 50, 0.95) 0%, rgba(15, 50, 30, 0.98) 100%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 2px,
      rgba(0, 0, 0, 0.03) 4px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 2px,
      rgba(0, 0, 0, 0.03) 4px
    )
  `;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
      }}
    >
      <div
        className="switcher-container"
        role="dialog"
        aria-modal="true"
        style={{
          background: feltBackground,
          boxShadow: `
            inset 0 0 150px rgba(0, 0, 0, 0.4),
            0 0 0 12px #3d2518,
            0 0 0 14px #2a1a10,
            0 0 0 20px #1a0f08,
            0 4px 20px rgba(0, 0, 0, 0.5),
            0 8px 40px rgba(0, 0, 0, 0.3)
          `,
          borderRadius: '24px',
          border: '4px solid #6b4423',
          width: '100%',
          height: '100%',
          maxWidth: 'calc(100vw - 80px)',
          maxHeight: 'calc(100vh - 80px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
      <div
        ref={tableRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {windows.length === 0 ? (
          <div
            className="empty-state"
            role="status"
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: theme.fonts.body,
            }}
          >
            No windows available
          </div>
        ) : (
          windows.map((win, index) => {
            const initialPos = getInitialPosition(win.id, index, windows.length);
            return (
              <motion.div
                key={win.id}
                drag
                dragConstraints={tableRef}
                dragElastic={0.1}
                dragMomentum={true}
                initial={{
                  x: initialPos.x,
                  y: initialPos.y,
                  rotate: initialPos.rotate,
                  scale: 0.8,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 25,
                  delay: index * 0.05,
                }}
                whileDrag={{
                  scale: 1.05,
                  cursor: 'grabbing',
                }}
                whileHover={{ scale: 1.02 }}
                onDragStart={() => {
                  setDraggedCard(win.id);
                  bringToFront(index);
                }}
                onDragEnd={(_, info) => handleDragEnd(win.id, info)}
                style={{
                  position: 'absolute',
                  zIndex: draggedCard === win.id ? 1000 : getZIndex(index),
                  cursor: 'grab',
                }}
              >
                <div onDoubleClick={() => handleTileClick(index)}>
                  {win.alexandriaEntry ? (
                    <LocalProjectCard
                      entry={win.alexandriaEntry}
                      width={220}
                      height={300}
                      isSelected={index === selectedIndex}
                    />
                  ) : (
                    <WindowCard
                      id={win.id}
                      title={win.title}
                      isSelected={index === selectedIndex}
                      onClick={() => {}} // No-op, double-click handled by wrapper
                    />
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
      <p
        className="hint"
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontFamily: theme.fonts.body,
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <strong>⌘'</strong> toggle • <strong>⌘;</strong> cycle (release to
        activate) • <strong>↑↓</strong> navigate • <strong>Enter</strong>{' '}
        activate • <strong>Double-click</strong> open • <strong>Esc</strong> close
      </p>
      </div>
    </div>
  );
};
