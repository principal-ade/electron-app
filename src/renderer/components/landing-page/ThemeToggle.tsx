import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface ThemeToggleProps {
  style?: React.CSSProperties;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ style }) => {
  const { theme, colorMode, toggleColorMode } = useTheme();

  return (
    <button
      onClick={toggleColorMode}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor =
          theme.colors.backgroundSecondary;
        e.currentTarget.style.transform = 'scale(1)';
      }}
      aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
    >
      {colorMode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};
