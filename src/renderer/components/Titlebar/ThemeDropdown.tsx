import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Palette } from 'lucide-react';
import { predefinedThemes, getThemeNames } from '../../themes/predefinedThemes';
import { ThemeService } from '../../services/ThemeService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';

export const ThemeDropdown: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<string>('terminal');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, colorMode } = useTheme();
  const availableThemes = getThemeNames();

  useEffect(() => {
    // Load current theme preference
    UserPreferencesService.getPreferences()
      .then(prefs => {
        if (prefs.selectedTheme) {
          setSelectedTheme(prefs.selectedTheme);
        }
      })
      .catch(console.error);

    // Listen for theme changes
    const unsubscribe = ThemeService.onThemeChange(({ themeName }) => {
      setSelectedTheme(themeName);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleThemeChange = async (themeName: string) => {
    setSelectedTheme(themeName);
    setIsDropdownOpen(false);
    await ThemeService.applyTheme(themeName, true);
  };

  const backgroundColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.backgroundSecondary || theme.colors.backgroundSecondary
      : theme.colors.backgroundSecondary;

  const accentColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.accent || theme.colors.accent
      : theme.colors.accent;

  return (
    <div
      ref={dropdownRef}
      className="titlebar-theme-dropdown"
      style={{
        position: 'relative',
        WebkitAppRegion: 'no-drag' as any,
        zIndex: 100
      }}
    >
      <button
        className="titlebar-theme-button"
        onClick={(e) => {
          e.stopPropagation();
          console.log('Theme button clicked, current state:', isDropdownOpen);
          setIsDropdownOpen(!isDropdownOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'transparent',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          color: accentColor,
          cursor: 'pointer',
          fontSize: '13px',
          fontFamily: theme.fonts.body,
          transition: 'all 0.2s ease',
          WebkitAppRegion: 'no-drag' as any,
          position: 'relative',
          zIndex: 101
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.hover || 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Palette size={14} />
        <span>{predefinedThemes[selectedTheme]?.name || 'Theme'}</span>
      </button>

      {isDropdownOpen && (
        <div
          className="theme-dropdown-menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor: backgroundColor,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            minWidth: '220px',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {availableThemes.map((themeName) => {
            const themeInfo = predefinedThemes[themeName];
            const isSelected = themeName === selectedTheme;
            return (
              <button
                key={themeName}
                className="theme-dropdown-item"
                onClick={() => handleThemeChange(themeName)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: isSelected
                    ? theme.colors.hover || 'rgba(255, 255, 255, 0.1)'
                    : 'transparent',
                  border: 'none',
                  color: isSelected ? accentColor : theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: theme.fonts.body,
                  textAlign: 'left',
                  transition: 'background-color 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.hover || 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ fontWeight: isSelected ? 600 : 400 }}>
                  {themeInfo.name}
                </div>
                <div style={{
                  fontSize: '11px',
                  opacity: 0.7,
                }}>
                  {themeInfo.description}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};