import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const MetricBox = ({ icon, label, value, isExceeded, threshold, customColor, onClick, isClickable = false, }) => {
    const { theme } = useTheme();
    // Use custom color if provided, otherwise use default logic
    const valueColor = customColor || (isExceeded ? '#F44336' : theme.colors.text);
    return (_jsxs("div", { onClick: onClick, style: {
            padding: '16px',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '8px',
            border: `1px solid ${isExceeded ? '#F44336' : theme.colors.border}`,
            flex: '1 1 0',
            minWidth: '0',
            position: 'relative',
            cursor: isClickable ? 'pointer' : 'default',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        }, onMouseEnter: (e) => {
            if (isClickable) {
                e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = isExceeded
                    ? '#F44336'
                    : theme.colors.primary;
            }
        }, onMouseLeave: (e) => {
            if (isClickable) {
                e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                e.currentTarget.style.borderColor = isExceeded
                    ? '#F44336'
                    : theme.colors.border;
            }
        }, children: [isExceeded && (_jsx("div", { title: `Exceeded threshold of ${threshold}`, style: {
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#F44336',
                    borderRadius: '50%',
                } })), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                }, children: [_jsx("div", { style: {
                            color: customColor || (isExceeded ? '#F44336' : 'inherit'),
                            opacity: 0.8,
                        }, children: icon }), _jsx("span", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            flex: 1,
                        }, children: label })] }), _jsx("div", { style: {
                    fontSize: '24px',
                    fontWeight: 600,
                    color: valueColor,
                    textAlign: 'center',
                }, children: value.toLocaleString() }), isExceeded && threshold && (_jsxs("div", { style: {
                    marginTop: '4px',
                    fontSize: '11px',
                    color: '#F44336',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                }, children: [_jsx("span", { children: "\u26A0\uFE0F" }), _jsxs("span", { children: ["> ", threshold] })] }))] }));
};
