import React, { useState, useEffect, useRef } from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import { useTheme } from '@principal-ade/industry-theme';
import { RotateCcw, X, Sun, Moon, Code2, type LucideIcon } from 'lucide-react';
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

// The three themes the in-panel switch offers, each with its own label/icon.
const THEME_SWITCH: { themeName: string; label: string; Icon: LucideIcon }[] = [
  { themeName: 'iceTangerine', label: 'Light', Icon: Sun },
  { themeName: 'iceTangerineDark', label: 'Dark', Icon: Moon },
  { themeName: 'slateNeon', label: 'Dev', Icon: Code2 },
];

type TabId = (typeof TAB_OPTIONS)[number]['id'];

interface FontOption {
  label: string;
  value: string;
  categories: Array<'sans' | 'serif' | 'monospace' | 'ui'>;
}

const FONT_OPTIONS: FontOption[] = [
  { label: 'Inter', value: '"Inter", sans-serif', categories: ['sans', 'ui'] },
  {
    label: 'Roboto',
    value: '"Roboto", sans-serif',
    categories: ['sans', 'ui'],
  },
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const ThemeCustomizationPanel: React.FC<
  ThemeCustomizationPanelProps
> = ({ themeName, onClose }) => {
  const { theme } = useTheme();
  const [activeThemeName, setActiveThemeName] = useState(themeName);
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [baseTheme, setBaseTheme] = useState<Theme | null>(null);
  const snapshotRef = useRef<Theme | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('colors');
  const [fontInputs, setFontInputs] = useState<Record<string, string>>({});

  // Load theme on mount and capture snapshot
  useEffect(() => {
    const loadTheme = async () => {
      const active = await ThemeService.getActiveTheme(activeThemeName);
      const base = ThemeService.getBaseTheme(activeThemeName);

      if (active) {
        setCurrentTheme(active);
        snapshotRef.current = JSON.parse(JSON.stringify(active)); // Deep clone
      } else {
        console.error('Failed to load active theme:', activeThemeName);
      }

      if (base) {
        setBaseTheme(base);
      } else {
        console.error('Failed to load base theme:', activeThemeName);
      }
    };

    loadTheme();
  }, [activeThemeName]);

  const getThemeValue = (themeToRead: Theme | null, path: string): string => {
    if (!themeToRead) return '';

    let value: unknown = themeToRead;

    for (const part of path.split('.')) {
      if (!isRecord(value)) {
        return '';
      }

      const record = value as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(record, part)) {
        return '';
      }

      value = record[part];
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
      await ThemeService.updateThemeSetting(activeThemeName, path, newValue);

      // Reload theme to get updated values
      const updatedTheme = await ThemeService.getActiveTheme(activeThemeName);
      if (updatedTheme) {
        setCurrentTheme(updatedTheme);
      }
    } catch (error) {
      console.error('Failed to update theme setting:', error);
    }
  };

  const handleThemeSwitch = async (name: string) => {
    if (name === activeThemeName) return;
    setActiveThemeName(name);
    await ThemeService.applyTheme(name, true);
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
      await ThemeService.clearThemeOverrides(activeThemeName);
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
            position: 'relative',
            padding: '20px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              padding: 0,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <X size={18} />
          </button>
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
          {/* 3-way theme switch */}
          <div
            style={{
              display: 'inline-flex',
              margin: '12px 0',
              padding: '3px',
              gap: '2px',
              borderRadius: '999px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
            {THEME_SWITCH.map(({ themeName: name, label, Icon }) => {
              const isActive = name === activeThemeName;
              return (
                <button
                  key={name}
                  onClick={() => handleThemeSwitch(name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : 'transparent',
                    color: isActive
                      ? theme.colors.background
                      : theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.background;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            <button
              onClick={handleRevertAll}
              title="Revert all changes"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
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
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
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
                        fontFamily:
                          value || getThemeValue(baseTheme, control.path),
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
