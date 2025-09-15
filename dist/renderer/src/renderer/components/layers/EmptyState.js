import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const EmptyState = ({ icon = '📭', title, description, action, }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
        }, children: [_jsx("div", { style: {
                    fontSize: '48px',
                    marginBottom: '16px',
                    opacity: 0.8,
                }, children: icon }), _jsx("h3", { style: {
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: theme.colors.text,
                }, children: title }), description && (_jsx("p", { style: {
                    margin: '0 0 24px 0',
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    maxWidth: '300px',
                }, children: description })), action && (_jsx("button", { onClick: action.onClick, style: {
                    padding: '8px 16px',
                    backgroundColor: theme.colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                }, onMouseEnter: (e) => (e.currentTarget.style.opacity = '0.9'), onMouseLeave: (e) => (e.currentTarget.style.opacity = '1'), children: action.label }))] }));
};
