import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import type { RepositoryViewType } from '../../../../shared/types/userPreferences.types';

export type RepositoryMode = RepositoryViewType;

interface ModeSelectorProps {
  mode: RepositoryMode;
  onModeChange?: (mode: RepositoryMode) => void;
  hasLocalClones?: boolean;
  disabled?: boolean;
}

interface ModeOption {
  value: RepositoryMode;
  label: string;
  color: string;
  requiresClone?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  mode,
  onModeChange,
  hasLocalClones = false,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const modes: ModeOption[] = [
    {
      value: 'exploration',
      label: 'Explore',
      color: '#3b82f6',
    },
    {
      value: 'collaboration',
      label: 'Develop',
      color: '#10b981',
      requiresClone: true,
    },
    {
      value: 'planning',
      label: 'Planning',
      color: '#f59e0b',
      requiresClone: true,
    },
    {
      value: 'deployment',
      label: 'Maintain',
      color: '#8b5cf6',
    },
  ];

  const currentMode = modes.find((m) => m.value === mode) || modes[0];

  const handleModeSelect = (newMode: RepositoryMode) => {
    const modeOption = modes.find((m) => m.value === newMode);
    if (modeOption?.requiresClone && !hasLocalClones) {
      return;
    }
    onModeChange?.(newMode);
    setIsOpen(false);
  };

  // Custom angles for each position - outer buttons spread wide, middle buttons closer
  const customAngles = [-90, -20, 20, 90]; // Explore, Develop, Planning, Maintain - outer ones horizontal, middle ones closer

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Current mode display */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 20px',
          backgroundColor: currentMode.color + '15',
          border: `2px solid ${currentMode.color}`,
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: currentMode.color,
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'scale(1.05)' : 'scale(1)',
          zIndex: 10,
          position: 'relative',
          minWidth: '100px',
        }}
      >
        <span>{currentMode.label}</span>
      </button>

      {/* Invisible hover bridge to maintain open state */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '500px', // Increased width for wider button spread
            height: '50px',
            pointerEvents: 'auto',
            zIndex: 8,
          }}
        />
      )}

      {/* Half-wheel selector */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '4px',
          pointerEvents: isOpen ? 'auto' : 'none',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 9,
        }}
      >
        {/* All modes arranged in a half-wheel */}
        {modes.map((modeOption, index) => {
          const angle = customAngles[index];
          const radius = 120; // Increased radius for more spacing
          const x = Math.sin((angle * Math.PI) / 180) * radius;
          const y = Math.cos((angle * Math.PI) / 180) * radius * 0.25;

          const isDisabled = modeOption.requiresClone && !hasLocalClones;
          const isCurrent = modeOption.value === mode;

          return (
            <button
              key={modeOption.value}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled && !isCurrent) {
                  handleModeSelect(modeOption.value);
                }
              }}
              disabled={isDisabled || isCurrent}
              style={{
                position: 'absolute',
                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px 12px',
                minWidth: '70px',
                backgroundColor: isCurrent
                  ? theme.colors.backgroundTertiary + '60' // Ghosted background for current
                  : isDisabled
                    ? theme.colors.backgroundTertiary
                    : modeOption.color + '15',
                border: `2px solid ${
                  isCurrent
                    ? theme.colors.border + '40' // Ghosted border for current
                    : isDisabled
                      ? theme.colors.border
                      : modeOption.color
                }`,
                borderRadius: '6px',
                color: isCurrent
                  ? theme.colors.textTertiary + '80' // Ghosted text for current
                  : isDisabled
                    ? theme.colors.textTertiary
                    : modeOption.color,
                fontSize: '12px',
                fontWeight: 600,
                cursor: isCurrent
                  ? 'default'
                  : isDisabled
                    ? 'not-allowed'
                    : 'pointer',
                transition:
                  'opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease',
                opacity: isOpen ? (isCurrent ? 0.4 : isDisabled ? 0.5 : 1) : 0,
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isDisabled && !isCurrent) {
                  e.currentTarget.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1.1)`;
                  e.currentTarget.style.backgroundColor =
                    modeOption.color + '25';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled && !isCurrent) {
                  e.currentTarget.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)`;
                  e.currentTarget.style.backgroundColor =
                    modeOption.color + '15';
                }
              }}
              title={
                isCurrent
                  ? `${modeOption.label} (current)`
                  : `${modeOption.label}${isDisabled ? ' (requires local clone)' : ''}`
              }
            >
              {modeOption.label}
            </button>
          );
        })}

        {/* Connecting lines */}
        <svg
          style={{
            position: 'absolute',
            left: '50%',
            top: '-6px',
            transform: 'translateX(-50%)',
            width: '250px', // Increased width for wider spread
            height: '100px',
            pointerEvents: 'none',
            opacity: isOpen ? 0.3 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          {modes.map((modeOption, index) => {
            const angle = customAngles[index];
            const radius = 120; // Match the button radius
            const x = Math.sin((angle * Math.PI) / 180) * radius + 125; // Adjusted center point
            const y = Math.cos((angle * Math.PI) / 180) * radius * 0.25 + 6;
            const isCurrent = modeOption.value === mode;

            return (
              <line
                key={index}
                x1="125" // Adjusted center point
                y1="6"
                x2={x}
                y2={y}
                stroke={
                  isCurrent ? theme.colors.border + '40' : theme.colors.border
                }
                strokeWidth="1"
                strokeDasharray={isCurrent ? '1,3' : '2,2'}
                opacity={isCurrent ? 0.3 : 1}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
