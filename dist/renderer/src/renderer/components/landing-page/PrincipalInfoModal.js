import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { X } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { PrincipalIntroPanel } from '../PrincipalIntroPanel';
export const PrincipalInfoModal = ({ isOpen, onClose, }) => {
    const { theme } = useTheme();
    if (!isOpen)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 9998,
                    animation: 'fadeIn 0.2s ease-out',
                }, onClick: onClose }), _jsxs("div", { style: {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: '1400px',
                    height: '85vh',
                    backgroundColor: theme.colors.background,
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.2s ease-out',
                }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '20px 24px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            flexShrink: 0,
                        }, children: [_jsx("h2", { style: {
                                    fontSize: '20px',
                                    fontWeight: 600,
                                    margin: 0,
                                    color: theme.colors.text,
                                }, children: "Principal MCP: Your AI Development Mentor" }), _jsx("button", { onClick: onClose, style: {
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: theme.colors.textSecondary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                    e.currentTarget.style.color = theme.colors.text;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                }, "aria-label": "Close", children: _jsx(X, { size: 20 }) })] }), _jsx("div", { style: {
                            flex: 1,
                            overflow: 'auto',
                            minHeight: 0,
                        }, children: _jsx(PrincipalIntroPanel, {}) })] }), _jsx("style", { children: `
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      ` })] }));
};
