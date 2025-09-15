import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ThemedOwlIcon } from './ThemedOwlIcon';
import { useTheme } from 'themed-markdown';
export const AppLogo = ({ size = 48, showText = true, compact = false }) => {
    const { theme } = useTheme();
    if (compact) {
        return _jsx(ThemedOwlIcon, { size: size });
    }
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: showText ? '12px' : 0,
        }, children: [_jsx(ThemedOwlIcon, { size: size }), showText && (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                }, children: [_jsx("span", { style: {
                            fontSize: size * 0.4,
                            fontWeight: 700,
                            color: theme.colors.text,
                            letterSpacing: '-0.02em',
                        }, children: "PrincipleMD" }), _jsx("span", { style: {
                            fontSize: size * 0.25,
                            color: theme.colors.textSecondary,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            opacity: 0.8,
                        }, children: "Repository Manager" })] }))] }));
};
