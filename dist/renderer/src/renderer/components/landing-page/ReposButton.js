import { jsx as _jsx } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const ReposButton = ({ isActive, onClick, onMouseEnter, onMouseLeave, }) => {
    const { theme } = useTheme();
    return (_jsx("button", { onClick: onClick, style: {
            padding: '8px 16px',
            borderRadius: '6px',
            minWidth: '120px',
            backgroundColor: isActive
                ? theme.colors.primary
                : theme.colors.backgroundSecondary,
            color: isActive
                ? theme.colors.background
                : theme.colors.text,
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            border: 'none',
            cursor: 'pointer',
        }, onMouseEnter: (e) => {
            if (!isActive) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                e.currentTarget.style.color = theme.colors.primary;
            }
            onMouseEnter?.(e);
        }, onMouseLeave: (e) => {
            if (!isActive) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.color = theme.colors.text;
            }
            onMouseLeave?.(e);
        }, children: _jsx("span", { children: "Projects" }) }));
};
