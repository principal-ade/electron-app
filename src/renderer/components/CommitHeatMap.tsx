/**
 * CommitHeatMap
 *
 * Displays a GitHub-style commit activity heat map showing commit frequency
 * over the past weeks. Each cell represents a day, with color intensity
 * indicating the number of commits. Automatically scales to fill container width.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Play, Pause } from 'lucide-react';

export interface CommitDay {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number;
}

export type PlayMode = 'year' | 'week' | 'today';

export interface CommitHeatMapProps {
  /** Array of commit data with date and count */
  commits: CommitDay[];
  /** Number of weeks to display (default: 52) */
  weeks?: number;
  /** Whether the component is loading */
  loading?: boolean;
  /** Currently selected date (controlled) */
  selectedDate?: string | null;
  /** Callback when a day is clicked */
  onDayClick?: (date: string, count: number) => void;
  /** Whether playback is active */
  isPlaying?: boolean;
  /** Callback when play/pause is clicked with mode */
  onPlayPause?: (mode: PlayMode) => void;
  /** Current play mode */
  playMode?: PlayMode;
  /** Whether transitioning between repos (triggers dissolve effect) */
  transitioning?: boolean;
}

// Day labels for the Y axis
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month labels
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAY_LABEL_WIDTH = 28;
const MIN_CELL_SIZE = 8;
const CELL_GAP = 2;

export const CommitHeatMap: React.FC<CommitHeatMapProps> = ({
  commits,
  weeks = 52,
  loading = false,
  selectedDate = null,
  onDayClick,
  isPlaying = false,
  onPlayPause,
  playMode = 'year',
  transitioning = false,
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Dissolve effect state
  const [dissolvedCells, setDissolvedCells] = useState<Set<string>>(new Set());
  const [isDissolving, setIsDissolving] = useState(false);
  const totalCells = weeks * 7;

  // Start dissolve when transitioning begins
  useEffect(() => {
    if (transitioning && !isDissolving) {
      setIsDissolving(true);
      setDissolvedCells(new Set());
    }
  }, [transitioning, isDissolving]);

  // Animate dissolve - clear cells randomly
  useEffect(() => {
    if (!isDissolving) return;

    const remainingCells = totalCells - dissolvedCells.size;
    if (remainingCells <= 0) {
      // All dissolved, wait for new data
      return;
    }

    // Clear 5-8 cells at a time
    const cellsPerTick = Math.min(6, remainingCells);
    const delay = 20; // ms

    const timeout = setTimeout(() => {
      setDissolvedCells(prev => {
        const next = new Set(prev);
        const allCellKeys: string[] = [];

        // Generate all possible cell keys
        for (let w = 0; w < weeks; w++) {
          for (let d = 0; d < 7; d++) {
            const key = `${w}-${d}`;
            if (!next.has(key)) {
              allCellKeys.push(key);
            }
          }
        }

        // Pick random cells to dissolve
        for (let i = 0; i < cellsPerTick && allCellKeys.length > 0; i++) {
          const randomIdx = Math.floor(Math.random() * allCellKeys.length);
          next.add(allCellKeys.splice(randomIdx, 1)[0]);
        }

        return next;
      });
    }, delay);

    return () => clearTimeout(timeout);
  }, [isDissolving, dissolvedCells, totalCells, weeks]);

  // Reset dissolve when new data arrives
  useEffect(() => {
    if (!transitioning && isDissolving && commits.length > 0) {
      setIsDissolving(false);
      setDissolvedCells(new Set());
    }
  }, [transitioning, isDissolving, commits.length]);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate cell size based on container width to fill the full width
  const cellSize = useMemo(() => {
    if (containerWidth === 0) return MIN_CELL_SIZE;

    // Account for padding (16px * 2 = 32) and day label width
    const availableWidth = containerWidth - DAY_LABEL_WIDTH - 32;
    // Calculate size needed to fill the width exactly
    const calculatedSize = (availableWidth - (weeks - 1) * CELL_GAP) / weeks;

    return Math.max(MIN_CELL_SIZE, calculatedSize);
  }, [containerWidth, weeks]);

  // Build a map of date -> count for quick lookup
  const commitMap = useMemo(() => {
    const map = new Map<string, number>();
    commits.forEach(({ date, count }) => {
      map.set(date, count);
    });
    return map;
  }, [commits]);

  // Calculate the grid data
  const { grid, monthLabels, maxCount } = useMemo(() => {
    const today = new Date();
    const totalDays = weeks * 7;

    // Find the start date (going back `weeks` weeks, aligned to Sunday)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);
    // Align to the previous Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    // Build the grid (columns = weeks, rows = days of week)
    const gridData: (CommitDay | null)[][] = [];
    const months: { label: string; column: number }[] = [];
    let currentMonth = -1;
    let maxCommits = 0;

    for (let week = 0; week < weeks; week++) {
      const column: (CommitDay | null)[] = [];

      for (let day = 0; day < 7; day++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + week * 7 + day);

        // Don't include future dates
        if (cellDate > today) {
          column.push(null);
          continue;
        }

        const dateStr = cellDate.toISOString().split('T')[0];
        const count = commitMap.get(dateStr) || 0;
        maxCommits = Math.max(maxCommits, count);

        // Track month changes for labels
        const month = cellDate.getMonth();
        if (month !== currentMonth && day === 0) {
          currentMonth = month;
          months.push({ label: MONTH_LABELS[month], column: week });
        }

        column.push({ date: dateStr, count });
      }

      gridData.push(column);
    }

    return { grid: gridData, monthLabels: months, maxCount: maxCommits };
  }, [weeks, commitMap]);

  // Get color intensity based on commit count
  const getColor = (count: number): string => {
    if (count === 0) {
      return theme.colors.backgroundTertiary;
    }

    // Use theme primary color with varying opacity
    const primaryColor = theme.colors.primary;

    // Calculate intensity (0-4 levels like GitHub)
    const intensity = maxCount > 0
      ? Math.min(4, Math.ceil((count / maxCount) * 4))
      : 0;

    // Return color with appropriate opacity
    const opacities = [0.2, 0.4, 0.6, 0.8, 1.0];
    const opacity = opacities[intensity];

    // Parse the primary color and apply opacity
    // Assuming primaryColor is a hex color
    if (primaryColor.startsWith('#')) {
      const r = parseInt(primaryColor.slice(1, 3), 16);
      const g = parseInt(primaryColor.slice(3, 5), 16);
      const b = parseInt(primaryColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    return primaryColor;
  };

  // Calculate total commits
  const totalCommits = useMemo(() => {
    return commits.reduce((sum, { count }) => sum + count, 0);
  }, [commits]);

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
  };

  const borderRadius = theme.radii?.[1] || 4;

  // When loading, we still render the full grid structure with empty data
  // to avoid layout jitter

  // Calculate the position for each month label
  const getMonthLabelStyle = (column: number, index: number, total: number) => {
    const position = DAY_LABEL_WIDTH + column * (cellSize + CELL_GAP);
    // Calculate width until next month or end
    const nextColumn = index < total - 1 ? monthLabels[index + 1].column : weeks;
    const width = (nextColumn - column) * (cellSize + CELL_GAP);

    return {
      position: 'absolute' as const,
      left: position,
      width: Math.max(width - 4, 20),
      fontSize: theme.fontSizes[0],
      color: theme.colors.textSecondary,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
    };
  };

  return (
    <div
      ref={containerRef}
      style={{
        padding: spacing.md,
        background: theme.colors.backgroundSecondary,
        borderRadius: borderRadius,
        border: `1px solid ${theme.colors.border}`,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Commit Activity
        </h4>
        <span
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
          }}
        >
          {loading ? '—' : `${totalCommits} commits`} in the last year
        </span>
      </div>

      {/* Heat map container */}
      <div style={{ position: 'relative' }}>
        {/* Month labels */}
        <div
          style={{
            position: 'relative',
            height: 16,
            marginBottom: spacing.xs,
          }}
        >
          {monthLabels.map(({ label, column }) => (
            <span
              key={`month-${column}`}
              style={getMonthLabelStyle(column, monthLabels.findIndex(m => m.column === column), monthLabels.length)}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Grid with day labels */}
        <div style={{ display: 'flex' }}>
          {/* Day labels */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: DAY_LABEL_WIDTH,
              flexShrink: 0,
              gap: CELL_GAP,
            }}
          >
            {DAY_LABELS.map((label, index) => (
              <div
                key={label}
                style={{
                  height: cellSize,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  visibility: index % 2 === 1 ? 'visible' : 'hidden', // Show Mon, Wed, Fri
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Heat map grid */}
          <div style={{ display: 'flex', gap: CELL_GAP, flex: 1 }}>
            {grid.map((week, weekIndex) => {
              const weekKey = week.find(d => d !== null)?.date || `empty-${weekIndex}`;
              return (
              <div
                key={`week-${weekKey}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: CELL_GAP,
                }}
              >
                {week.map((day, dayIndex) => {
                  const isSelected = day && selectedDate === day.date;
                  const cellKey = `${weekIndex}-${dayIndex}`;
                  const isDissolved = dissolvedCells.has(cellKey);

                  // When dissolved, show the "0 commits" color (empty state)
                  const emptyColor = theme.colors.backgroundTertiary;

                  return (
                  <div
                    key={day?.date || `empty-${weekKey}-${dayIndex}`}
                    title={day ? `${day.date}: ${day.count} commit${day.count !== 1 ? 's' : ''}` : ''}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 2,
                      backgroundColor: isDissolved
                        ? emptyColor
                        : (day ? getColor(day.count) : emptyColor),
                      cursor: day && onDayClick && !isDissolving ? 'pointer' : 'default',
                      transition: 'transform 0.1s ease, box-shadow 0.1s ease, background-color 0.15s ease-out',
                      boxShadow: isSelected && !isDissolved
                        ? `0 0 0 2px ${theme.colors.background}, 0 0 0 4px ${theme.colors.primary}`
                        : 'none',
                      position: 'relative',
                      zIndex: isSelected ? 1 : 0,
                    }}
                    onClick={() => {
                      if (day && onDayClick && !isDissolving) {
                        onDayClick(day.date, day.count);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (day && !isDissolving) {
                        e.currentTarget.style.transform = 'scale(1.2)';
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
              );
            })}
          </div>
        </div>

        {/* Bottom bar with play buttons and legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.sm,
          }}
        >
          {/* Play buttons */}
          {onPlayPause && (
            <div style={{ display: 'flex', gap: spacing.xs }}>
              {/* Stop button when playing */}
              {isPlaying ? (
                <button
                  onClick={() => onPlayPause(playMode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    background: theme.colors.warning,
                    color: theme.colors.background,
                    border: 'none',
                    borderRadius: borderRadius,
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[1],
                  }}
                >
                  <Pause size={14} />
                  Pause
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onPlayPause('today')}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      background: theme.colors.primary,
                      color: theme.colors.background,
                      border: 'none',
                      borderRadius: borderRadius,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: theme.fontSizes[1],
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <Play size={14} />
                    Today
                  </button>
                  <button
                    onClick={() => onPlayPause('week')}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      background: theme.colors.primary,
                      color: theme.colors.background,
                      border: 'none',
                      borderRadius: borderRadius,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: theme.fontSizes[1],
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <Play size={14} />
                    This Week
                  </button>
                  <button
                    onClick={() => onPlayPause('year')}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      background: theme.colors.backgroundTertiary,
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: borderRadius,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: theme.fontSizes[1],
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <Play size={14} />
                    Full Year
                  </button>
                </>
              )}
            </div>
          )}
          {!onPlayPause && <div />}

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <span
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              Less
            </span>
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  backgroundColor: getColor(level === 0 ? 0 : (level / 4) * (maxCount || 1)),
                }}
              />
            ))}
            <span
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              More
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommitHeatMap;
