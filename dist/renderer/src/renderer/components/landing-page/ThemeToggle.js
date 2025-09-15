import { jsx as _jsx } from "react/jsx-runtime";
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const ThemeToggle = ({ style }) => {
    const { theme, colorMode, toggleColorMode } = useTheme();
    return (_jsx("button", { onClick: toggleColorMode, style: {
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
        }, onMouseEnter: (e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            e.currentTarget.style.transform = 'scale(1.05)';
        }, onMouseLeave: (e) => {
            e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            e.currentTarget.style.transform = 'scale(1)';
        }, "aria-label": `Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`, title: `Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`, children: colorMode === 'light' ? _jsx(Moon, { size: 20 }) : _jsx(Sun, { size: 20 }) }));
};
