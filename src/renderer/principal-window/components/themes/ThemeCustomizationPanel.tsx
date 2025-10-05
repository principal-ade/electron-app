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

const TAB_OPTIONS = [
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
] as const;

type TabId = (typeof TAB_OPTIONS)[number]['id'];

interface FontOption {
  label: string;
  value: string;
  categories: Array<'sans' | 'serif' | 'monospace' | 'ui'>;
}

const FONT_OPTIONS: FontOption[] = [
  { label: 'Inter', value: '"Inter", sans-serif', categories: ['sans', 'ui'] },
  { label: 'Roboto', value: '"Roboto", sans-serif', categories: ['sans', 'ui'] },
  {
    label: 'Open Sans',
    value: '"Open Sans", sans-serif',
    categories: ['sans', 'ui'],
  },
  { label: 'Lato', value: '"Lato", sans-serif', categories: ['sans', 'ui'] },
  {
    label: 'Source Sans Pro',
    value: '"Source Sans Pro", sans-serif',
    categories: ['sans', 'ui'],
  },
  {
    label: 'Work Sans',
    value: '"Work Sans", sans-serif',
    categories: ['sans', 'ui'],
  },
  {
    label: 'IBM Plex Sans',
    value: '"IBM Plex Sans", sans-serif',
    categories: ['sans', 'ui'],
  },
  {
    label: 'Montserrat',
    value: '"Montserrat", sans-serif',
    categories: ['sans'],
  },
  {
    label: 'Poppins',
    value: '"Poppins", sans-serif',
    categories: ['sans'],
  },
  {
    label: 'Nunito',
    value: '"Nunito", sans-serif',
    categories: ['sans'],
  },
  {
    label: 'Raleway',
    value: '"Raleway", sans-serif',
    categories: ['sans'],
  },
  {
    label: 'Merriweather',
    value: '"Merriweather", serif',
    categories: ['serif'],
  },
  {
    label: 'Playfair Display',
    value: '"Playfair Display", serif',
    categories: ['serif'],
  },
  {
    label: 'Crimson Text',
    value: '"Crimson Text", serif',
    categories: ['serif'],
  },
  { label: 'Georgia', value: 'Georgia, serif', categories: ['serif'] },
  {
    label: 'Roboto Slab',
    value: '"Roboto Slab", serif',
    categories: ['serif'],
  },
  {
    label: 'Times New Roman',
    value: '"Times New Roman", serif',
    categories: ['serif'],
  },
  {
    label: 'Fira Code',
    value: '"Fira Code", monospace',
    categories: ['monospace'],
  },
  {
    label: 'Source Code Pro',
    value: '"Source Code Pro", monospace',
    categories: ['monospace'],
  },
  {
    label: 'JetBrains Mono',
    value: '"JetBrains Mono", monospace',
    categories: ['monospace'],
  },
  {
    label: 'IBM Plex Mono',
    value: '"IBM Plex Mono", monospace',
    categories: ['monospace'],
  },
  {
    label: 'Space Mono',
    value: '"Space Mono", monospace',
    categories: ['monospace'],
  },
  {
    label: 'Inconsolata',
    value: 'Inconsolata, monospace',
    categories: ['monospace'],
  },
  { label: 'Menlo', value: 'Menlo, monospace', categories: ['monospace'] },
  {
    label: 'Courier New',
    value: '"Courier New", monospace',
    categories: ['monospace'],
  },
];

interface FontControlConfig {
  label: string;
  path: string;
  description: string;
  categories: Array<'sans' | 'serif' | 'monospace' | 'ui'>;
}

const FONT_CONTROLS: FontControlConfig[] = [
  {
    label: 'Heading Font',
    path: 'fonts.heading',
    description: 'Used for large titles and headings across the UI.',
    categories: ['sans', 'serif', 'ui'],
  },
  {
    label: 'Body Font',
    path: 'fonts.body',
    description: 'Applies to general copy and longer text blocks.',
    categories: ['sans', 'serif', 'ui'],
  },
  {
    label: 'UI Font',
    path: 'fonts.ui',
    description: 'Controls labels, navigation, and small interface text.',
    categories: ['sans', 'serif', 'ui'],
  },
  {
    label: 'Monospace Font',
    path: 'fonts.monospace',
    description: 'Ideal for code snippets, terminals, and technical data.',
    categories: ['monospace'],
  },
];

export const ThemeCustomizationPanel: React.FC<ThemeCustomizationPanelProps> = ({
  themeName,
  onClose,
}) => {
  console.log('ThemeCustomizationPanel component initialized!', { themeName });
  const { theme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [baseTheme, setBaseTheme] = useState<Theme | null>(null);
  const snapshotRef = useRef<Theme | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('colors');
  const [fontInputs, setFontInputs] = useState<Record<string, string>>({});

  // Load theme on mount and capture snapshot
  useEffect(() => {
    const loadTheme = async () => {
      console.log('Loading theme:', themeName);
      const active = await ThemeService.getActiveTheme(themeName);
      const base = ThemeService.getBaseTheme(themeName);

      console.log('Theme loaded:', { active, base });

      if (active) {
        setCurrentTheme(active);
        snapshotRef.current = JSON.parse(JSON.stringify(active)); // Deep clone
      } else {
        console.error('Failed to load active theme:', themeName);
      }

      if (base) {
        setBaseTheme(base);
      } else {
        console.error('Failed to load base theme:', themeName);
      }
    };

    loadTheme();
  }, [themeName]);

  const getThemeValue = (themeToRead: Theme | null, path: string): string => {
    if (!themeToRead) return '';

    const parts = path.split('.');
    let value: any = themeToRead;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return '';
      }
    }

    return typeof value === 'string' ? value : '';
  };

  const getColorValue = (themeToRead: Theme | null, path: string): string => {
    const value = getThemeValue(themeToRead, path);
    return value || '#000000';
  };

  useEffect(() => {
    if (!currentTheme) return;

    const initialFontValues: Record<string, string> = {};
    for (const control of FONT_CONTROLS) {
      initialFontValues[control.path] = getThemeValue(
        currentTheme,
        control.path,
      );
    }
    setFontInputs(initialFontValues);
  }, [currentTheme]);

  const handleSettingChange = async (path: string, newValue: string) => {
    try {
      await ThemeService.updateThemeSetting(themeName, path, newValue);

      // Reload theme to get updated values
      const updatedTheme = await ThemeService.getActiveTheme(themeName);
      if (updatedTheme) {
        setCurrentTheme(updatedTheme);
      }
    } catch (error) {
      console.error('Failed to update theme setting:', error);
    }
  };

  // Handle color change
  const handleColorChange = async (path: string, newValue: string) => {
    await handleSettingChange(path, newValue);
  };

  const handleFontChange = async (path: string, newValue: string) => {
    if (newValue.trim() === '') {
      await handleResetSetting(path);
      return;
    }

    setFontInputs((prev) => ({
      ...prev,
      [path]: newValue,
    }));
    await handleSettingChange(path, newValue);
  };

  // Reset single color to base theme
  const handleResetColor = async (path: string) => {
    if (!baseTheme) return;

    const defaultValue = getColorValue(baseTheme, path);
    await handleColorChange(path, defaultValue);
  };

  const handleResetSetting = async (path: string) => {
    if (!baseTheme) return;

    const defaultValue = getThemeValue(baseTheme, path);
    setFontInputs((prev) => ({
      ...prev,
      [path]: defaultValue,
    }));
    await handleSettingChange(path, defaultValue);
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
    console.log('ThemeCustomizationPanel: waiting for themes to load...', { currentTheme, baseTheme });
    return null;
  }

  console.log('ThemeCustomizationPanel: rendering panel!');

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
              margin: '4px 0 12px 0',
              fontSize: '13px',
              color: theme.colors.textSecondary,
            }}
          >
            Editing: {themeName}
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            {TAB_OPTIONS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '999px',
                    border: `1px solid ${
                      isActive ? theme.colors.primary : theme.colors.border
                    }`,
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : theme.colors.background,
                    color: isActive
                      ? theme.colors.background
                      : theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.background;
                    }
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
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

          {activeTab === 'colors' && (
            <>
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
                      onChange={(newValue) =>
                        handleColorChange(color.path, newValue)
                      }
                      onReset={() => handleResetColor(color.path)}
                      defaultValue={getColorValue(baseTheme, color.path)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}

          {activeTab === 'typography' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {FONT_CONTROLS.map((control) => {
                const value = fontInputs[control.path] ?? '';
                const options = FONT_OPTIONS.filter((option) =>
                  option.categories.some((category) =>
                    control.categories.includes(category),
                  ),
                );

                return (
                  <div
                    key={control.path}
                    style={{
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: '10px',
                      border: `1px solid ${theme.colors.border}`,
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '15px',
                              fontWeight: 600,
                              color: theme.colors.text,
                            }}
                          >
                            {control.label}
                          </h4>
                          <p
                            style={{
                              margin: '4px 0 0 0',
                              fontSize: '12px',
                              color: theme.colors.textSecondary,
                            }}
                          >
                            {control.description}
                          </p>
                        </div>
                        <button
                          onClick={() => handleResetSetting(control.path)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                            color: theme.colors.text,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              theme.colors.backgroundTertiary ||
                              theme.colors.backgroundSecondary;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              theme.colors.background;
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <label
                        style={{
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Choose from library
                      </label>
                      <select
                        value={value}
                        onChange={(event) =>
                          handleFontChange(control.path, event.target.value)
                        }
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                          fontSize: '14px',
                        }}
                      >
                        <option value="">Default</option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <label
                        style={{
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Or provide a custom font stack
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          setFontInputs((prev) => ({
                            ...prev,
                            [control.path]: event.target.value,
                          }))
                        }
                        onBlur={(event) =>
                          handleFontChange(control.path, event.target.value)
                        }
                        placeholder='e.g. "Inter", "Helvetica", sans-serif'
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                          fontSize: '14px',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: theme.colors.background,
                        border: `1px dashed ${theme.colors.border}`,
                        color: theme.colors.text,
                        fontFamily: value || getThemeValue(baseTheme, control.path),
                        fontSize: '14px',
                        lineHeight: 1.6,
                      }}
                    >
                      The quick brown fox jumps over the lazy dog.
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
