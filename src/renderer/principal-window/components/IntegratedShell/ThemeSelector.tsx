import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Sun, Moon, Code2, Settings, type LucideIcon } from 'lucide-react';
import { ThemeService } from '../../../services/ThemeService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { ThemeCustomizationPanel } from '../themes/ThemeCustomizationPanel';

// The three themes this selector offers, each with its own label and icon.
const THEME_OPTIONS: { themeName: string; label: string; Icon: LucideIcon }[] = [
  { themeName: 'iceTangerine', label: 'Light', Icon: Sun },
  { themeName: 'iceTangerineDark', label: 'Dark', Icon: Moon },
  { themeName: 'slateNeon', label: 'Dev', Icon: Code2 },
];

export const ThemeSelector: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<string>(
    ThemeService.getCurrentThemeName(),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, mode } = useTheme();

  useEffect(() => {
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        if (prefs.selectedTheme) {
          setSelectedTheme(prefs.selectedTheme);
        }
      })
      .catch(console.error);

    const unsubscribe = ThemeService.onThemeChange(({ themeName }) => {
      setSelectedTheme(themeName);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (themeName: string) => {
    setSelectedTheme(themeName);
    setIsOpen(false);
    await ThemeService.applyTheme(themeName, true);
  };

  const handleCustomize = () => {
    setIsOpen(false);
    setShowCustomization(true);
  };

  const current =
    THEME_OPTIONS.find((t) => t.themeName === selectedTheme) ?? THEME_OPTIONS[0];
  const { label, Icon } = current;

  const backgroundColor =
    mode === 'dark' && theme.modes?.dark?.backgroundSecondary
      ? theme.modes.dark.backgroundSecondary
      : theme.colors.backgroundSecondary;
  const hoverColor = theme.colors.backgroundHover || 'rgba(255, 255, 255, 0.1)';

  return (
    <>
    <div
      ref={containerRef}
      className="titlebar-theme-selector"
      style={{
        // position: relative anchors the absolutely-positioned dropdown below.
        // Deliberately NO z-index here: the titlebar ancestors don't establish a
        // stacking context, so any z-index on this container leaks into the
        // window's root stacking context and paints the (closed) button over body
        // modals — which live inside panel stacking contexts and so can't out-rank
        // it despite their high z-index values. The dropdown carries its own
        // zIndex below for when it's open.
        position: 'relative',
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      <button
        className="titlebar-theme-selector-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((open) => !open);
        }}
        title="Select theme"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'transparent',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          color: theme.colors.accent,
          cursor: 'pointer',
          fontSize: '13px',
          fontFamily: theme.fonts.body,
          transition: 'all 0.2s ease',
          WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = hoverColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Icon size={14} />
        <span style={{ minWidth: '32px', textAlign: 'left' }}>{label}</span>
      </button>

      {isOpen && (
        <div
          className="theme-selector-menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            minWidth: '140px',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {THEME_OPTIONS.map(({ themeName, label: optLabel, Icon: OptIcon }) => {
            const isSelected = themeName === selectedTheme;
            return (
              <button
                key={themeName}
                className="theme-selector-item"
                onClick={() => handleSelect(themeName)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: isSelected ? hoverColor : 'transparent',
                  border: 'none',
                  color: isSelected ? theme.colors.accent : theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: theme.fonts.body,
                  fontWeight: isSelected ? 600 : 400,
                  textAlign: 'left',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor =
                      'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <OptIcon size={14} />
                <span>{optLabel}</span>
              </button>
            );
          })}

          <div
            style={{
              height: '1px',
              backgroundColor: theme.colors.border,
              margin: '4px 0',
            }}
          />

          <button
            className="theme-selector-item"
            onClick={handleCustomize}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.text,
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: theme.fonts.body,
              textAlign: 'left',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Settings size={14} />
            <span>Customize</span>
          </button>
        </div>
      )}
    </div>

    {showCustomization && (
      <ThemeCustomizationPanel
        themeName={selectedTheme}
        onClose={() => setShowCustomization(false)}
      />
    )}
    </>
  );
};
