import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const LoadingState = ({ message = 'Loading...', variant = 'spinner', height = 200, }) => {
    const { theme } = useTheme();
    if (variant === 'skeleton') {
        return (_jsxs("div", { style: { height }, children: [[1, 2, 3].map((i) => (_jsx("div", { style: {
                        height: '60px',
                        marginBottom: '8px',
                        backgroundColor: theme.colors.backgroundLight,
                        borderRadius: '6px',
                        position: 'relative',
                        overflow: 'hidden',
                    }, children: _jsx("div", { style: {
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: `linear-gradient(90deg, transparent, ${theme.colors.backgroundSecondary}, transparent)`,
                            animation: 'shimmer 1.5s infinite',
                        } }) }, i))), _jsx("style", { children: `
          @keyframes shimmer {
            to {
              left: 100%;
            }
          }
        ` })] }));
    }
    if (variant === 'dots') {
        return (_jsxs("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height,
                gap: '16px',
            }, children: [_jsx("div", { style: { display: 'flex', gap: '8px' }, children: [0, 1, 2].map((i) => (_jsx("div", { style: {
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: theme.colors.primary,
                            animation: `pulse 1.4s infinite ease-in-out ${i * 0.16}s`,
                        } }, i))) }), _jsx("div", { style: {
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                    }, children: message }), _jsx("style", { children: `
          @keyframes pulse {
            0%, 80%, 100% {
              transform: scale(0);
              opacity: 0;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }
        ` })] }));
    }
    // Default spinner variant
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height,
            gap: '16px',
        }, children: [_jsx("div", { style: {
                    width: '32px',
                    height: '32px',
                    border: `3px solid ${theme.colors.backgroundLight}`,
                    borderTopColor: theme.colors.primary,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                } }), _jsx("div", { style: {
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                }, children: message }), _jsx("style", { children: `
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      ` })] }));
};
