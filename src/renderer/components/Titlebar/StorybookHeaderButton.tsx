import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Square } from 'lucide-react';
import type { Theme } from '@principal-ade/industry-theme';
import type { StorybookManager } from '../../hooks/useStorybookManager';

export interface StorybookHeaderButtonProps {
  theme: Theme;
  storybook: StorybookManager;
  repositoryPath?: string;
}

/**
 * Header button that starts and stops Storybook.
 * When multiple Storybook packages exist, opens a dropdown to pick which one.
 */
export const StorybookHeaderButton: React.FC<StorybookHeaderButtonProps> = ({
  theme,
  storybook,
  repositoryPath,
}) => {
  const {
    packages,
    selectedPackage,
    isRunning,
    isStarting,
    start,
    stop,
  } = storybook;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (packages.length === 0) return null;

  const hasMultiple = packages.length > 1;
  const label = isStarting
    ? 'Starting...'
    : isRunning
      ? 'Stop Storybook'
      : 'Start Storybook';

  const handleClick = () => {
    if (isStarting) return;
    if (isRunning) {
      stop();
      return;
    }
    if (hasMultiple) {
      setOpen((prev) => !prev);
      return;
    }
    start();
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'no-drag',
      }}
    >
      <button
        onClick={handleClick}
        disabled={isStarting}
        title={
          isRunning
            ? `Stop Storybook${selectedPackage ? ` (${selectedPackage.name})` : ''}`
            : hasMultiple
              ? 'Start Storybook (select package)'
              : `Start Storybook${selectedPackage ? ` (${selectedPackage.name})` : ''}`
        }
        style={{
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
          background: isRunning
            ? `${theme.colors.success}20`
            : theme.colors.backgroundTertiary,
          border: `1px solid ${
            isRunning ? theme.colors.success : theme.colors.border
          }`,
          color: isRunning
            ? theme.colors.success
            : theme.colors.textSecondary,
          cursor: isStarting ? 'wait' : 'pointer',
          padding: '6px 12px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s',
          fontSize: `${theme.fontSizes[1]}px`,
          fontWeight: theme.fontWeights.medium,
          opacity: isStarting ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (isStarting) return;
          if (!isRunning) {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
            e.currentTarget.style.borderColor = theme.colors.primary;
            e.currentTarget.style.color = theme.colors.text;
          }
        }}
        onMouseLeave={(e) => {
          if (isStarting) return;
          if (!isRunning) {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundTertiary;
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }
        }}
      >
        {isRunning ? <Square size={14} /> : <BookOpen size={14} />}
        <span>{label}</span>
        {hasMultiple && !isRunning && !isStarting && (
          <ChevronDown size={12} />
        )}
      </button>

      {open && hasMultiple && !isRunning && !isStarting && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            zIndex: 1000,
            minWidth: '220px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: theme.fonts.body,
            overflow: 'hidden',
          }}
        >
          {packages.map((pkg, idx) => {
            const isSelected = selectedPackage?.path === pkg.path;
            const subpath =
              pkg.path.replace(repositoryPath || '', '').replace(/^\//, '') ||
              '/';
            return (
              <button
                key={pkg.path}
                onClick={() => {
                  setOpen(false);
                  start(pkg);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom:
                    idx === packages.length - 1
                      ? 'none'
                      : `1px solid ${theme.colors.border}`,
                  background: isSelected
                    ? `${theme.colors.primary}20`
                    : 'transparent',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: `${theme.fontSizes[1]}px`,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ fontWeight: theme.fontWeights.medium }}>
                  {pkg.name}
                </div>
                <div
                  style={{
                    fontSize: `${theme.fontSizes[0]}px`,
                    color: theme.colors.textTertiary,
                    marginTop: '2px',
                  }}
                >
                  {subpath}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
