import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { MapIcon } from 'lucide-react';
export const EmptyState = ({ message }) => {
    const { theme } = useTheme();
    return (_jsx("div", { style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.backgroundSecondary,
            padding: '40px'
        }, children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx(MapIcon, { size: 48, color: theme.colors.textSecondary, style: { opacity: 0.3, marginBottom: '16px' } }), _jsx("p", { style: { color: theme.colors.textSecondary, margin: 0 }, children: message })] }) }));
};
