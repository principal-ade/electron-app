/**
 * HourlyActivityHeatmap
 *
 * Displays a granular activity heat map showing commit frequency
 * at 10-minute intervals. Each row represents an hour, with 6 blocks
 * per row (one per 10-minute window). Most recent at top, scrolling
 * down goes back in time. Cell size is based on width (squares),
 * and number of rows is determined by available height.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

export interface CommitTimestamp {
  timestamp: Date | string;
  repoId?: string;
}

export interface HourlyActivityHeatmapProps {
  /** Array of commit timestamps */
  commits: CommitTimestamp[];
  /** Whether the component is loading */
  loading?: boolean;
  /** Callback when a block is clicked */
  onBlockClick?: (startTime: Date, endTime: Date, count: number) => void;
  /** Selected time block (ISO string of block start) */
  selectedBlock?: string | null;
}

const HOUR_LABEL_WIDTH = 48;
const MIN_CELL_SIZE = 12;
const CELL_GAP = 2;
const BLOCKS_PER_HOUR = 6; // 10-minute blocks

// Format hour for display (e.g., "2 PM", "9 AM")
const formatHour = (hour: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
};

// Day quarter types and helpers
type DayQuarter = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

const getQuarter = (hour: number): DayQuarter => {
  if (hour >= 0 && hour < 6) return 'Night';
  if (hour >= 6 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  return 'Evening';
};

const getGreeting = (quarter: DayQuarter): string => {
  switch (quarter) {
    case 'Night': return 'Welcome Night Owls';
    case 'Morning': return 'Good Morning';
    case 'Afternoon': return 'Good Afternoon';
    case 'Evening': return 'Good Evening';
  }
};

const getQuarterLabel = (quarter: DayQuarter): string => {
  switch (quarter) {
    case 'Night': return 'Night Shift';
    default: return quarter;
  }
};

// Get the start of a 10-minute block for a given date
const _getBlockStart = (date: Date): Date => {
  const blockStart = new Date(date);
  const minutes = Math.floor(date.getMinutes() / 10) * 10;
  blockStart.setMinutes(minutes, 0, 0);
  return blockStart;
};

// Generate a unique key for an hour row
const getHourKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
};

// Generate a unique key for a block
const getBlockKey = (date: Date): string => {
  const blockIndex = Math.floor(date.getMinutes() / 10);
  return `${getHourKey(date)}-${blockIndex}`;
};

export const HourlyActivityHeatmap: React.FC<HourlyActivityHeatmapProps> = ({
  commits,
  loading: _loading = false,
  onBlockClick,
  selectedBlock = null,
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Current time state - updates every second to handle time boundary crossings
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Derived: elapsed minutes within current 10-minute block
  const elapsedMinutes = currentTime.getMinutes() % 10;

  // Key that changes only when we cross a 10-minute boundary (for grid recalculation)
  const currentBlockKey = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}-${currentTime.getHours()}-${Math.floor(currentTime.getMinutes() / 10)}`;

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Measure container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate cell size based on width (must be square)
  const cellSize = useMemo(() => {
    if (dimensions.width === 0) return MIN_CELL_SIZE;

    // Available width for the 6 blocks
    const availableWidth = dimensions.width - HOUR_LABEL_WIDTH - (BLOCKS_PER_HOUR - 1) * CELL_GAP;
    const calculatedSize = availableWidth / BLOCKS_PER_HOUR;

    return Math.max(MIN_CELL_SIZE, Math.floor(calculatedSize));
  }, [dimensions.width]);

  // Calculate how many hour rows fit
  const maxRows = useMemo(() => {
    if (dimensions.height === 0) return 24;

    const legendHeight = 32;
    const availableHeight = dimensions.height - legendHeight;
    const rowHeight = cellSize + CELL_GAP;

    return Math.max(1, Math.floor(availableHeight / rowHeight));
  }, [dimensions.height, cellSize]);

  // Build a map of block -> count for quick lookup
  const { blockMap, maxCount, quarterCounts } = useMemo(() => {
    const map = new Map<string, number>();
    const quarters = new Map<string, number>();
    let max = 0;

    commits.forEach(({ timestamp }) => {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const key = getBlockKey(date);
      const count = (map.get(key) || 0) + 1;
      map.set(key, count);
      max = Math.max(max, count);

      // Count commits per quarter (date + quarter)
      const quarterKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${getQuarter(date.getHours())}`;
      quarters.set(quarterKey, (quarters.get(quarterKey) || 0) + 1);
    });

    return { blockMap: map, maxCount: max, quarterCounts: quarters };
  }, [commits]);

  // Generate the grid data (hours as rows, most recent first)
  // Recalculates when crossing a 10-minute boundary (currentBlockKey changes)
  const hourRows = useMemo(() => {
    const now = new Date(); // Fresh date for accurate comparisons
    const rows: Array<{
      hourKey: string;
      hourLabel: string;
      date: Date;
      blocks: Array<{
        blockKey: string;
        blockIndex: number;
        startTime: Date;
        endTime: Date;
        count: number;
        isFuture: boolean;
        isCurrent: boolean;
      }>;
    }> = [];

    // Start from current hour and go backwards
    for (let i = 0; i < maxRows; i++) {
      const hourDate = new Date(now);
      hourDate.setHours(now.getHours() - i, 0, 0, 0);

      const hourKey = getHourKey(hourDate);
      const blocks = [];

      for (let blockIndex = 0; blockIndex < BLOCKS_PER_HOUR; blockIndex++) {
        const startTime = new Date(hourDate);
        startTime.setMinutes(blockIndex * 10, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(startTime.getMinutes() + 10);

        const blockKey = `${hourKey}-${blockIndex}`;
        const count = blockMap.get(blockKey) || 0;
        const isFuture = startTime > now;
        const isCurrent = now >= startTime && now < endTime;

        blocks.push({
          blockKey,
          blockIndex,
          startTime,
          endTime,
          count,
          isFuture,
          isCurrent,
        });
      }

      rows.push({
        hourKey,
        hourLabel: formatHour(hourDate.getHours()),
        date: hourDate,
        blocks,
      });
    }

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxRows, blockMap, currentBlockKey]);

  // Get color intensity based on commit count
  const getColor = (count: number, isFuture: boolean): string => {
    if (isFuture) {
      return theme.colors.backgroundSecondary;
    }

    if (count === 0) {
      return theme.colors.backgroundTertiary;
    }

    const primaryColor = theme.colors.primary;

    // Calculate intensity (0-4 levels like GitHub)
    const intensity = maxCount > 0
      ? Math.min(4, Math.ceil((count / maxCount) * 4))
      : 0;

    const opacities = [0.2, 0.4, 0.6, 0.8, 1.0];
    const opacity = opacities[intensity];

    if (primaryColor.startsWith('#')) {
      const r = parseInt(primaryColor.slice(1, 3), 16);
      const g = parseInt(primaryColor.slice(3, 5), 16);
      const b = parseInt(primaryColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    return primaryColor;
  };

  // Format time for tooltip
  const formatTimeRange = (start: Date, end: Date): string => {
    const formatTime = (d: Date) => {
      const hour = d.getHours();
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${displayHour}:${m} ${period}`;
    };
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  // Format date for day separator (returns null for today)
  const formatDate = (date: Date): string | null => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return null; // No label for today
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  // Track day and quarter changes for separators
  const getSeparator = (
    currentRow: typeof hourRows[0],
    prevRow: typeof hourRows[0] | null,
    isFirst: boolean
  ): { label: string; commitCount: number; dateLabel?: string } | null => {
    const currentQuarter = getQuarter(currentRow.date.getHours());
    const prevQuarter = prevRow ? getQuarter(prevRow.date.getHours()) : null;
    const isNewDay = !prevRow || currentRow.date.toDateString() !== prevRow.date.toDateString();
    const isNewQuarter = !prevRow || currentQuarter !== prevQuarter;

    if (!isNewDay && !isNewQuarter) return null;

    const quarterKey = `${currentRow.date.getFullYear()}-${currentRow.date.getMonth()}-${currentRow.date.getDate()}-${currentQuarter}`;
    const commitCount = quarterCounts.get(quarterKey) || 0;

    // Only the first separator gets "Good Morning" style, rest just show quarter name
    const label = isFirst ? getGreeting(currentQuarter) : getQuarterLabel(currentQuarter);

    const dateLabel = formatDate(currentRow.date);
    if (isNewDay && dateLabel) {
      return { label, commitCount, dateLabel };
    }
    return { label, commitCount };
  };

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  const _borderRadius = theme.radii?.[1] || 4;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: CELL_GAP,
        }}
      >
        {hourRows.map((row, rowIndex) => {
          const prevRow = rowIndex > 0 ? hourRows[rowIndex - 1] : null;
          const separator = getSeparator(row, prevRow, rowIndex === 0);

          return (
            <React.Fragment key={row.hourKey}>
              {/* Day or quarter separator */}
              {separator && (
                <div
                  style={{
                    paddingTop: rowIndex > 0 ? spacing.sm : 0,
                    paddingBottom: spacing.xs,
                    borderTop: rowIndex > 0 ? `1px solid ${theme.colors.border}` : undefined,
                    marginTop: rowIndex > 0 ? spacing.sm : 0,
                  }}
                >
                  {separator.dateLabel && (
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textTertiary,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {separator.dateLabel}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <div
                      style={{
                        fontSize: theme.fontSizes[2],
                        fontWeight: 600,
                        color: theme.colors.text,
                      }}
                    >
                      {separator.label}
                    </div>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textTertiary,
                      }}
                    >
                      {separator.commitCount} commit{separator.commitCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Hour row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: CELL_GAP,
                }}
              >
                {/* Hour label */}
                <div
                  style={{
                    width: HOUR_LABEL_WIDTH,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                    textAlign: 'right',
                    paddingRight: spacing.xs,
                    flexShrink: 0,
                  }}
                >
                  {row.hourLabel}
                </div>

                {/* Blocks */}
                {row.blocks.map((block) => {
                  const isSelected = selectedBlock === block.startTime.toISOString();

                  // For current block, render 3x3 mini-grid (9 cells for ~10 minutes)
                  if (block.isCurrent) {
                    const miniGap = 1;
                    const miniCellSize = (cellSize - miniGap * 2) / 3; // 3x3 grid with 2 gaps

                    // Find commits within this block and map to minute indices (0-9)
                    const commitMinutes = new Set<number>();
                    commits.forEach(({ timestamp }) => {
                      const commitDate = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
                      if (commitDate >= block.startTime && commitDate < block.endTime) {
                        const minuteInBlock = commitDate.getMinutes() % 10;
                        commitMinutes.add(minuteInBlock);
                      }
                    });

                    return (
                      <div
                        key={block.blockKey}
                        title={`${formatTimeRange(block.startTime, block.endTime)}: ${block.count} commit${block.count !== 1 ? 's' : ''} (now)`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 2,
                          backgroundColor: theme.colors.backgroundTertiary,
                          cursor: onBlockClick ? 'pointer' : 'default',
                          position: 'relative',
                          zIndex: isSelected ? 1 : 0,
                          boxShadow: isSelected
                            ? `0 0 0 2px ${theme.colors.background}, 0 0 0 4px ${theme.colors.primary}`
                            : 'none',
                          display: 'grid',
                          gridTemplateColumns: `repeat(3, ${miniCellSize}px)`,
                          gridTemplateRows: `repeat(3, ${miniCellSize}px)`,
                          gap: miniGap,
                          overflow: 'hidden',
                        }}
                        onClick={() => {
                          if (onBlockClick) {
                            onBlockClick(block.startTime, block.endTime, block.count);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.15)';
                          e.currentTarget.style.zIndex = '2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.zIndex = isSelected ? '1' : '0';
                        }}
                      >
                        {Array.from({ length: 9 }).map((_, i) => {
                          // Map cell index to minute (fill left-to-right, bottom-to-top)
                          // Cell layout:  0 1 2    Minute layout:  6 7 8
                          //               3 4 5                    3 4 5
                          //               6 7 8                    0 1 2
                          const row = Math.floor(i / 3);
                          const col = i % 3;
                          const minute = (2 - row) * 3 + col;

                          const hasCommit = commitMinutes.has(minute) || (minute === 8 && commitMinutes.has(9));
                          const isElapsed = minute < elapsedMinutes;

                          return (
                            <div
                              key={i}
                              style={{
                                width: miniCellSize,
                                height: miniCellSize,
                                borderRadius: 1,
                                backgroundColor: hasCommit
                                  ? theme.colors.primary
                                  : isElapsed
                                    ? theme.colors.textSecondary
                                    : theme.colors.backgroundTertiary,
                                opacity: hasCommit ? 1 : isElapsed ? 0.5 : 1,
                                transition: 'opacity 0.3s ease, background-color 0.3s ease',
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={block.blockKey}
                      title={
                        block.isFuture
                          ? 'Future'
                          : `${formatTimeRange(block.startTime, block.endTime)}: ${block.count} commit${block.count !== 1 ? 's' : ''}`
                      }
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: 2,
                        backgroundColor: getColor(block.count, block.isFuture),
                        cursor: block.isFuture || !onBlockClick ? 'default' : 'pointer',
                        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                        boxShadow: isSelected
                          ? `0 0 0 2px ${theme.colors.background}, 0 0 0 4px ${theme.colors.primary}`
                          : 'none',
                        position: 'relative',
                        zIndex: isSelected ? 1 : 0,
                        opacity: block.isFuture ? 0.3 : 1,
                      }}
                      onClick={() => {
                        if (!block.isFuture && onBlockClick) {
                          onBlockClick(block.startTime, block.endTime, block.count);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!block.isFuture) {
                          e.currentTarget.style.transform = 'scale(1.15)';
                          e.currentTarget.style.zIndex = '2';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.zIndex = isSelected ? '1' : '0';
                      }}
                    />
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          marginTop: spacing.sm,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textTertiary,
          }}
        >
          Less
        </span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            style={{
              width: Math.min(cellSize, 10),
              height: Math.min(cellSize, 10),
              borderRadius: 2,
              backgroundColor: getColor(level === 0 ? 0 : (level / 4) * (maxCount || 1), false),
            }}
          />
        ))}
        <span
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textTertiary,
          }}
        >
          More
        </span>
      </div>
    </div>
  );
};

export default HourlyActivityHeatmap;
