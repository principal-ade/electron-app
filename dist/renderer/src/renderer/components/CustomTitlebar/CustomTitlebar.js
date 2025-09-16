import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTheme } from 'themed-markdown';
import { Settings } from 'lucide-react';
import './CustomTitlebar.css';
// Use the simple custom titlebar implementation instead of the library
export const CustomTitlebar = ({ onSettingsClick, hasUpdateAvailable }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const { theme, colorMode } = useTheme();
    useEffect(() => {
        if (window.electronTitlebar) {
            // Check initial maximized state
            window.electronTitlebar.isMaximized().then(setIsMaximized);
            // Listen for maximize state changes
            window.electronTitlebar.onMaximizeChange(setIsMaximized);
        }
    }, []);
    if (!window.electronTitlebar) {
        return null; // Not in Electron environment
    }
    // Get the appropriate background color from theme
    const backgroundColor = colorMode === 'dark'
        ? theme.colors.modes?.dark?.backgroundSecondary || theme.colors.backgroundSecondary
        : theme.colors.backgroundSecondary;
    // Get the accent color for the title
    const accentColor = colorMode === 'dark'
        ? theme.colors.modes?.dark?.accent || theme.colors.accent
        : theme.colors.accent;
    return (_jsxs("div", { className: "custom-titlebar", style: { backgroundColor }, children: [_jsx("div", { className: "titlebar-drag-region", children: _jsx("div", { className: "titlebar-title", style: { color: accentColor }, children: "Principal AI" }) }), onSettingsClick && (_jsxs("button", { onClick: onSettingsClick, style: {
                    position: 'absolute',
                    right: isMac ? '16px' : '150px', // Position to left of window controls on Windows
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: colorMode === 'dark' ? '#9ca3af' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag',
                    zIndex: 10,
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.backgroundColor = colorMode === 'dark'
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.color = colorMode === 'dark' ? '#d1d5db' : '#374151';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colorMode === 'dark' ? '#9ca3af' : '#6b7280';
                }, "aria-label": "Settings", title: hasUpdateAvailable ? "Settings (Update Available)" : "Settings", children: [_jsx(Settings, { size: 18 }), hasUpdateAvailable && (_jsx("div", { style: {
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: theme.colors.warning || '#fbbf24',
                            boxShadow: `0 0 4px ${(theme.colors.warning || '#fbbf24')}80`,
                        } }))] })), !isMac && (_jsxs("div", { className: "titlebar-controls", children: [_jsx("button", { className: "titlebar-button minimize", onClick: () => window.electronTitlebar?.minimize(), "aria-label": "Minimize", children: _jsx("svg", { width: "12", height: "1", viewBox: "0 0 12 1", children: _jsx("rect", { fill: "currentColor", width: "12", height: "1" }) }) }), _jsx("button", { className: "titlebar-button maximize", onClick: () => window.electronTitlebar?.maximize(), "aria-label": isMaximized ? 'Restore' : 'Maximize', children: isMaximized ? (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", children: _jsx("path", { fill: "currentColor", d: "M2.4 0v2.4H0v9.6h9.6V9.6h2.4V0H2.4zm1.2 3.6h4.8v4.8H1.2V3.6h2.4zm4.8 1.2H3.6v3.6h4.8V4.8z" }) })) : (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", children: _jsx("rect", { fill: "currentColor", width: "12", height: "12", strokeWidth: "1", stroke: "currentColor" }) })) }), _jsx("button", { className: "titlebar-button close", onClick: () => window.electronTitlebar?.close(), "aria-label": "Close", children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", children: _jsx("path", { fill: "currentColor", d: "M1.69 0L6 4.31 10.31 0 12 1.69 7.69 6 12 10.31 10.31 12 6 7.69 1.69 12 0 10.31 4.31 6 0 1.69 1.69 0z" }) }) })] }))] }));
};
// Alternative simple custom titlebar without the library
export const SimpleCustomTitlebar = ({ onSettingsClick, hasUpdateAvailable }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const { theme, colorMode } = useTheme();
    useEffect(() => {
        if (window.electronTitlebar) {
            // Check initial maximized state
            window.electronTitlebar.isMaximized().then(setIsMaximized);
            // Listen for maximize state changes
            window.electronTitlebar.onMaximizeChange(setIsMaximized);
        }
    }, []);
    if (!window.electronTitlebar) {
        return null; // Not in Electron environment
    }
    // Get the appropriate background color from theme
    const backgroundColor = colorMode === 'dark'
        ? theme.colors.modes?.dark?.backgroundSecondary || theme.colors.backgroundSecondary
        : theme.colors.backgroundSecondary;
    // Get the accent color for the title
    const accentColor = colorMode === 'dark'
        ? theme.colors.modes?.dark?.accent || theme.colors.accent
        : theme.colors.accent;
    return (_jsxs("div", { className: "custom-titlebar", style: { backgroundColor }, children: [_jsx("div", { className: "titlebar-drag-region", children: _jsx("div", { className: "titlebar-title", style: { color: accentColor }, children: "Principal AI" }) }), onSettingsClick && (_jsxs("button", { onClick: onSettingsClick, style: {
                    position: 'absolute',
                    right: isMac ? '16px' : '150px', // Position to left of window controls on Windows
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: colorMode === 'dark' ? '#9ca3af' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag',
                    zIndex: 10,
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.backgroundColor = colorMode === 'dark'
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.color = colorMode === 'dark' ? '#d1d5db' : '#374151';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colorMode === 'dark' ? '#9ca3af' : '#6b7280';
                }, "aria-label": "Settings", title: hasUpdateAvailable ? "Settings (Update Available)" : "Settings", children: [_jsx(Settings, { size: 18 }), hasUpdateAvailable && (_jsx("div", { style: {
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: theme.colors.warning || '#fbbf24',
                            boxShadow: `0 0 4px ${(theme.colors.warning || '#fbbf24')}80`,
                        } }))] })), !isMac && (_jsxs("div", { className: "titlebar-controls", children: [_jsx("button", { className: "titlebar-button minimize", onClick: () => window.electronTitlebar.minimize(), "aria-label": "Minimize", children: _jsx("svg", { width: "12", height: "1", viewBox: "0 0 12 1", children: _jsx("rect", { fill: "currentColor", width: "12", height: "1" }) }) }), _jsx("button", { className: "titlebar-button maximize", onClick: () => window.electronTitlebar.maximize(), "aria-label": isMaximized ? 'Restore' : 'Maximize', children: isMaximized ? (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", children: _jsx("path", { fill: "currentColor", d: "M2.4 0v2.4H0v9.6h9.6V9.6h2.4V0H2.4zm1.2 3.6h4.8v4.8H1.2V3.6h2.4zm4.8 1.2H3.6v3.6h4.8V4.8z" }) })) : (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", children: _jsx("rect", { fill: "currentColor", width: "12", height: "12", strokeWidth: "1", stroke: "currentColor" }) })) }), _jsx("button", { className: "titlebar-button close", onClick: () => window.electronTitlebar.close(), "aria-label": "Close", children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", children: _jsx("path", { fill: "currentColor", d: "M1.69 0L6 4.31 10.31 0 12 1.69 7.69 6 12 10.31 10.31 12 6 7.69 1.69 12 0 10.31 4.31 6 0 1.69 1.69 0z" }) }) })] }))] }));
};
