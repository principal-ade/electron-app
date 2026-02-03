import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Settings } from 'lucide-react';
import { ThemeService } from '../../services/ThemeService';
import { ThemeCustomizationPanel } from '../../principal-window/components/themes/ThemeCustomizationPanel';

export const ThemeCustomizationButton: React.FC = () => {
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>('terminal');
  const { theme, colorMode } = useTheme();

  useEffect(() => {
    console.log('showCustomizationPanel changed to:', showCustomizationPanel);
  }, [showCustomizationPanel]);

  useEffect(() => {
    // Wait a bit for ThemeService to initialize, then get current theme
    const getThemeName = () => {
      const themeName = ThemeService.getCurrentThemeName();
      console.log('ThemeService.getCurrentThemeName() returned:', themeName);
      // Only update if it's not 'default' (which means not initialized yet)
      if (themeName && themeName !== 'default') {
        setCurrentTheme(themeName);
      }
    };

    // Try immediately
    getThemeName();

    // Also try after a delay in case ThemeService hasn't loaded yet
    const timeout = setTimeout(getThemeName, 100);

    // Listen for theme changes
    const unsubscribe = ThemeService.onThemeChange(({ themeName }) => {
      console.log('Theme changed to:', themeName);
      setCurrentTheme(themeName);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const accentColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.accent || theme.colors.accent
      : theme.colors.accent;

  return (
    <>
      <div
        className="titlebar-customize-button"
        style={{
          WebkitAppRegion: 'no-drag' as any,
          zIndex: 100,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('ThemeCustomizationButton clicked!');
            setShowCustomizationPanel(true);
            console.log('showCustomizationPanel set to true');
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
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.hover || 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Settings size={14} />
          <span>Customize</span>
        </button>
      </div>

      {showCustomizationPanel && (
        <ThemeCustomizationPanel
          themeName={currentTheme}
          onClose={() => setShowCustomizationPanel(false)}
        />
      )}
    </>
  );
};
