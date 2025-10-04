import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Settings } from 'lucide-react';
import { ThemeService } from '../../services/ThemeService';
import { ThemeCustomizationPanel } from '../../principal-window/components/themes/ThemeCustomizationPanel';

export const ThemeCustomizationButton: React.FC = () => {
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>('terminal');
  const { theme, colorMode } = useTheme();

  useEffect(() => {
    // Get current theme
    const themeName = ThemeService.getCurrentThemeName();
    setCurrentTheme(themeName);

    // Listen for theme changes
    const unsubscribe = ThemeService.onThemeChange(({ themeName }) => {
      setCurrentTheme(themeName);
    });

    return () => unsubscribe();
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
          zIndex: 100
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowCustomizationPanel(true);
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
            e.currentTarget.style.backgroundColor = theme.colors.hover || 'rgba(255, 255, 255, 0.1)';
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
