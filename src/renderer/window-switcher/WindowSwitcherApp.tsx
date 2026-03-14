import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { motion } from 'framer-motion';
import { LocalProjectCard } from '@industry-theme/repository-composition-panels';
import { Logo } from '@principal-ai/logo-component';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { WindowCard } from './WindowCard';

type SwitcherWindow = {
  id: number;
  title: string;
  primaryType?: string;
  alexandriaEntry?: AlexandriaEntry;
};

// Grid configuration
const GRID_COLS = 5;
const GRID_ROWS = 3;
const CARD_WIDTH = 220;
const CARD_HEIGHT = 300;
const CARD_GAP = 30;

// Grid cell index (row * GRID_COLS + col)
type GridPosition = number;

const GRID_POSITIONS_STORAGE_KEY = 'window-switcher-grid-positions';

// Load saved grid positions from localStorage
function loadSavedGridPositions(): Record<number, GridPosition> {
  try {
    const saved = localStorage.getItem(GRID_POSITIONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Save grid positions to localStorage
function saveGridPositions(positions: Record<number, GridPosition>) {
  try {
    localStorage.setItem(GRID_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

// Convert grid cell to pixel position (relative to center)
function gridToPixel(gridPos: GridPosition): { x: number; y: number } {
  const col = gridPos % GRID_COLS;
  const row = Math.floor(gridPos / GRID_COLS);

  // Calculate position relative to grid center
  const centerCol = (GRID_COLS - 1) / 2;
  const centerRow = (GRID_ROWS - 1) / 2;

  const x = (col - centerCol) * (CARD_WIDTH + CARD_GAP);
  const y = (row - centerRow) * (CARD_HEIGHT + CARD_GAP);

  return { x, y };
}

// Find nearest grid cell from pixel offset
function pixelToNearestGrid(x: number, y: number): GridPosition {
  const centerCol = (GRID_COLS - 1) / 2;
  const centerRow = (GRID_ROWS - 1) / 2;

  // Convert pixel offset back to grid coordinates
  let col = Math.round(x / (CARD_WIDTH + CARD_GAP) + centerCol);
  let row = Math.round(y / (CARD_HEIGHT + CARD_GAP) + centerRow);

  // Clamp to grid bounds
  col = Math.max(0, Math.min(GRID_COLS - 1, col));
  row = Math.max(0, Math.min(GRID_ROWS - 1, row));

  return row * GRID_COLS + col;
}

// Draggable card component using native mouse events
interface DraggableCardProps {
  gridPos: GridPosition;
  zIndex: number;
  children: React.ReactNode;
  onDragStart: () => void;
  onDragEnd: (offset: { x: number; y: number }) => void;
  onDoubleClick: () => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  gridPos,
  zIndex,
  children,
  onDragStart,
  onDragEnd,
  onDoubleClick,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const onDragEndRef = useRef(onDragEnd);
  const pixelPos = gridToPixel(gridPos);

  // Keep refs in sync
  onDragEndRef.current = onDragEnd;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = { x: 0, y: 0 };
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
    onDragStart();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const offsetX = e.clientX - startPosRef.current.x;
      const offsetY = e.clientY - startPosRef.current.y;
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      setDragOffset({ x: offsetX, y: offsetY });
    };

    const handleMouseUp = () => {
      const finalOffset = dragOffsetRef.current;
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      onDragEndRef.current(finalOffset);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Current position: base grid position + drag offset
  const currentX = pixelPos.x + dragOffset.x;
  const currentY = pixelPos.y + dragOffset.y;

  return (
    <motion.div
      style={{
        position: 'absolute',
        zIndex,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      animate={{
        x: currentX,
        y: currentY,
        scale: isDragging ? 1.05 : 1,
        opacity: 1,
      }}
      initial={{ x: pixelPos.x, y: pixelPos.y, scale: 0.8, opacity: 0 }}
      transition={
        isDragging
          ? { type: 'tween', duration: 0 }
          : { type: 'spring', stiffness: 400, damping: 30 }
      }
      whileHover={!isDragging ? { scale: 1.02 } : undefined}
      onMouseDown={handleMouseDown}
    >
      <div onDoubleClick={onDoubleClick}>
        {children}
      </div>
    </motion.div>
  );
};

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
  const [gridPositions, setGridPositions] = useState<Record<number, GridPosition>>(() => loadSavedGridPositions());

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

  // Separate main window from workspace windows
  const mainWindow = windows.find((w) => w.primaryType === 'main');
  const workspaceWindows = useMemo(
    () => windows.filter((w) => w.primaryType !== 'main'),
    [windows]
  );

  // Get all currently occupied grid positions
  const occupiedPositions = useMemo(() => {
    const occupied = new Set<GridPosition>();
    for (const win of workspaceWindows) {
      const pos = gridPositions[win.id];
      if (pos !== undefined) {
        occupied.add(pos);
      }
    }
    return occupied;
  }, [workspaceWindows, gridPositions]);

  // Find next available grid position
  const findAvailablePosition = (excludeWindowId?: number): GridPosition => {
    const occupied = new Set(occupiedPositions);
    if (excludeWindowId !== undefined) {
      occupied.delete(gridPositions[excludeWindowId]);
    }

    // Fill row by row, starting from top-left
    for (let pos = 0; pos < GRID_COLS * GRID_ROWS; pos++) {
      if (!occupied.has(pos)) return pos;
    }

    // Fallback to position 0 if grid is full
    return 0;
  };

  // Get grid position for a window (saved, or assign new)
  const getWindowGridPosition = (win: SwitcherWindow, _index: number): GridPosition => {
    // Check for saved position
    if (gridPositions[win.id] !== undefined) {
      return gridPositions[win.id];
    }

    // Find next available position
    return findAvailablePosition(win.id);
  };

  // Handle drag end - snap to nearest grid position
  const handleDragEnd = (windowId: number, info: { offset: { x: number; y: number } }) => {
    setDraggedCard(null);

    // Get current grid position and convert to pixels
    const currentGridPos = gridPositions[windowId] ?? 0;
    const currentPixel = gridToPixel(currentGridPos);

    // Calculate new position with drag offset
    const newX = currentPixel.x + info.offset.x;
    const newY = currentPixel.y + info.offset.y;

    // Find nearest grid cell
    let targetGridPos = pixelToNearestGrid(newX, newY);

    // Check if target is occupied by another window
    const occupiedByOther = workspaceWindows.some(
      (w) => w.id !== windowId && gridPositions[w.id] === targetGridPos
    );

    if (occupiedByOther) {
      // Swap positions with the other window
      const otherWindow = workspaceWindows.find((w) => gridPositions[w.id] === targetGridPos);
      if (otherWindow) {
        setGridPositions((prev) => {
          const updated = {
            ...prev,
            [windowId]: targetGridPos,
            [otherWindow.id]: currentGridPos,
          };
          saveGridPositions(updated);
          return updated;
        });
        return;
      }
    }

    // Move to target position
    setGridPositions((prev) => {
      const updated = { ...prev, [windowId]: targetGridPos };
      saveGridPositions(updated);
      return updated;
    });
  };

  // Handle clicking the main window header
  const handleMainWindowClick = () => {
    if (mainWindow && electronAPI) {
      electronAPI.selectWindow?.(mainWindow.id);
    }
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
      {/* Main window header - wooden plaque style */}
      {mainWindow && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={handleMainWindowClick}
            style={{
              position: 'relative',
              cursor: 'pointer',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* SVG trapezoid background with border */}
            <svg
              width="250"
              height="110"
              viewBox="0 0 250 110"
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="woodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#5c3d2e" />
                  <stop offset="50%" stopColor="#4a3122" />
                  <stop offset="100%" stopColor="#3d2518" />
                </linearGradient>
              </defs>
              {/* Trapezoid path: wider at top (250), narrower at bottom (150), rounded bottom corners */}
              <path
                d="M 0,0 L 250,0 L 200,95 Q 200,105 190,105 L 60,105 Q 50,105 50,95 L 0,0 Z"
                fill="url(#woodGradient)"
                stroke="#6b4423"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Hide top border by drawing over it */}
              <line x1="0" y1="1" x2="250" y2="1" stroke="url(#woodGradient)" strokeWidth="4" />
            </svg>

            {/* Content */}
            <div
              style={{
                position: 'relative',
                width: 250,
                height: 110,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '4px',
                paddingTop: '10px',
              }}
            >
              {/* Title */}
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: theme.fonts.heading,
                  letterSpacing: '1px',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Principal </span>
                <span style={{ color: theme.colors.primary }}>AI</span>
              </span>

              {/* Logo */}
              <div style={{ marginTop: '4px' }}>
                <Logo width={48} height={48} color={theme.colors.primary} />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Workspace cards */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          paddingTop: mainWindow ? '60px' : '0',
        }}
      >
        {workspaceWindows.length === 0 ? (
          <div
            className="empty-state"
            role="status"
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: theme.fonts.body,
            }}
          >
            No workspace windows open
          </div>
        ) : (
          workspaceWindows.map((win, index) => {
            const gridPos = getWindowGridPosition(win, index);

            // Initialize grid position if not set
            if (gridPositions[win.id] === undefined) {
              // Use setTimeout to avoid state update during render
              setTimeout(() => {
                setGridPositions((prev) => {
                  if (prev[win.id] === undefined) {
                    const updated = { ...prev, [win.id]: gridPos };
                    saveGridPositions(updated);
                    return updated;
                  }
                  return prev;
                });
              }, 0);
            }

            // Find the original index in windows array for selection
            const originalIndex = windows.findIndex((w) => w.id === win.id);

            return (
              <DraggableCard
                key={win.id}
                gridPos={gridPositions[win.id] ?? gridPos}
                zIndex={draggedCard === win.id ? 1000 : getZIndex(index)}
                onDragStart={() => {
                  setDraggedCard(win.id);
                  bringToFront(index);
                }}
                onDragEnd={(offset) => handleDragEnd(win.id, { offset })}
                onDoubleClick={() => handleTileClick(originalIndex)}
              >
                {win.alexandriaEntry ? (
                  <LocalProjectCard
                    entry={win.alexandriaEntry}
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    isSelected={originalIndex === selectedIndex}
                  />
                ) : (
                  <WindowCard
                    id={win.id}
                    title={win.title}
                    isSelected={originalIndex === selectedIndex}
                    onClick={() => {}} // No-op, double-click handled by wrapper
                  />
                )}
              </DraggableCard>
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
