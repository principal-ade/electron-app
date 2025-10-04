import React, { useState, useEffect, useRef } from 'react';
import type { Theme } from '@a24z/industry-theme';
import { useTheme } from '@a24z/industry-theme';
import { RotateCcw } from 'lucide-react';
import { ColorPickerInput } from './ColorPickerInput';
import { ThemeService } from '../../../services/ThemeService';

interface ThemeCustomizationPanelProps {
  themeName: string;
  onClose: () => void;
}

interface ColorConfig {
  label: string;
  path: string;
}

const COLOR_GROUPS: Record<string, ColorConfig[]> = {
  'Primary Colors': [
    { label: 'Primary', path: 'colors.primary' },
    { label: 'Secondary', path: 'colors.secondary' },
    { label: 'Accent', path: 'colors.accent' },
  ],
  'Background Colors': [
    { label: 'Background', path: 'colors.background' },
    { label: 'Background Light', path: 'colors.backgroundLight' },
    { label: 'Background Dark', path: 'colors.backgroundDark' },
    { label: 'Background Secondary', path: 'colors.backgroundSecondary' },
    { label: 'Background Tertiary', path: 'colors.backgroundTertiary' },
  ],
  'Text Colors': [
    { label: 'Text', path: 'colors.text' },
    { label: 'Text Secondary', path: 'colors.textSecondary' },
    { label: 'Text Tertiary', path: 'colors.textTertiary' },
  ],
  'UI Colors': [
    { label: 'Border', path: 'colors.border' },
    { label: 'Border Light', path: 'colors.borderLight' },
    { label: 'Border Dark', path: 'colors.borderDark' },
  ],
  'Status Colors': [
    { label: 'Success', path: 'colors.success' },
    { label: 'Warning', path: 'colors.warning' },
    { label: 'Error', path: 'colors.error' },
    { label: 'Info', path: 'colors.info' },
  ],
};

export const ThemeCustomizationPanel: React.FC<ThemeCustomizationPanelProps> = ({
  themeName,
  onClose,
}) => {
  const { theme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [baseTheme, setBaseTheme] = useState<Theme | null>(null);
  const snapshotRef = useRef<Theme | null>(null);

  // Load theme on mount and capture snapshot
  useEffect(() => {
    const loadTheme = async () => {
      const active = await ThemeService.getActiveTheme(themeName);
      const base = ThemeService.getBaseTheme(themeName);

      if (active) {
        setCurrentTheme(active);
        snapshotRef.current = JSON.parse(JSON.stringify(active)); // Deep clone
      }

      if (base) {
        setBaseTheme(base);
      }
    };

    loadTheme();
  }, [themeName]);

  // Get color value from theme using path
  const getColorValue = (theme: Theme | null, path: string): string => {
    if (!theme) return '#000000';

    const parts = path.split('.');
    let value: any = theme;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return '#000000';
      }
    }

    return typeof value === 'string' ? value : '#000000';
  };

  // Handle color change
  const handleColorChange = async (path: string, newValue: string) => {
    try {
      await ThemeService.updateThemeColor(themeName, path, newValue);

      // Reload theme to get updated values
      const updatedTheme = await ThemeService.getActiveTheme(themeName);
      if (updatedTheme) {
        setCurrentTheme(updatedTheme);
      }
    } catch (error) {
      console.error('Failed to update color:', error);
    }
  };

  // Reset single color to base theme
  const handleResetColor = async (path: string) => {
    if (!baseTheme) return;

    const defaultValue = getColorValue(baseTheme, path);
    await handleColorChange(path, defaultValue);
  };

  // Revert all changes
  const handleRevertAll = async () => {
    if (!snapshotRef.current) return;

    try {
      await ThemeService.clearThemeOverrides(themeName);
      onClose();
    } catch (error) {
      console.error('Failed to revert theme:', error);
    }
  };

  if (!currentTheme || !baseTheme) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 0, 0, 0.3)`,
          zIndex: 9999,
        }}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '450px',
          maxWidth: '90vw',
          backgroundColor: theme.colors.background,
          borderLeft: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: `-4px 0 24px rgba(0, 0, 0, 0.4)`,
          zIndex: 10000,
          animation: 'slideInFromRight 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Customize Theme
          </h3>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: theme.colors.textSecondary,
            }}
          >
            Editing: {themeName}
          </p>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              fontSize: '13px',
              color: theme.colors.textSecondary,
            }}
          >
            💡 Changes are saved automatically and reflected throughout the app
          </div>

          {Object.entries(COLOR_GROUPS).map(([groupName, colors]) => (
            <div key={groupName} style={{ marginBottom: '32px' }}>
              <h4
                style={{
                  margin: '0 0 16px 0',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                {groupName}
              </h4>
              {colors.map((color) => (
                <ColorPickerInput
                  key={color.path}
                  label={color.label}
                  value={getColorValue(currentTheme, color.path)}
                  onChange={(newValue) => handleColorChange(color.path, newValue)}
                  onReset={() => handleResetColor(color.path)}
                  defaultValue={getColorValue(baseTheme, color.path)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleRevertAll}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.background;
            }}
          >
            <RotateCcw size={16} />
            Revert All Changes
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};
