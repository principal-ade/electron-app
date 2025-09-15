import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { FileText, Scroll, Trash2, ToggleLeft, ToggleRight, Settings, } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const HookSquare = ({ command, matcher, color, onEdit, onRemove, onShowInfo, enabled = true, onToggle, layout = 'grid', }) => {
    const { theme } = useTheme();
    const [showActions, setShowActions] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [hoveredButton, setHoveredButton] = useState(null);
    // Extract command name for display
    const fullName = command.split('/').pop() || command;
    const commandName = fullName.replace(/\.(sh|js|py)$/, '');
    const fileExtension = fullName.match(/\.(sh|js|py)$/)?.[1] || 'sh';
    // List layout
    if (layout === 'list') {
        return (_jsxs("div", { className: `flex items-center justify-between rounded-lg p-4 transition-all ${!enabled ? 'opacity-50' : ''}`, style: {
                backgroundColor: isHovered ? theme.colors.backgroundHover : theme.colors.surface
            }, onMouseEnter: () => setIsHovered(true), onMouseLeave: () => setIsHovered(false), children: [_jsxs("div", { className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx("div", { className: "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", style: { backgroundColor: `${color}20` }, children: _jsx("span", { style: { color }, children: fileExtension === 'js' ? (_jsx(Scroll, { size: 20 })) : fileExtension === 'py' ? ('🐍') : (_jsx(FileText, { size: 20 })) }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "font-medium text-white truncate", title: commandName, children: commandName }), _jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("code", { className: "px-2 py-0.5 rounded font-mono", style: {
                                                backgroundColor: theme.colors.background,
                                                color: theme.colors.textTertiary
                                            }, children: matcher }), _jsx("span", { className: "truncate", style: { color: theme.colors.textSecondary }, title: command, children: command })] })] })] }), _jsxs("div", { className: "flex items-center gap-1 ml-4", children: [onToggle && (_jsxs("button", { onClick: (e) => {
                                e.stopPropagation();
                                onToggle();
                            }, className: "p-2 rounded transition-colors flex items-center gap-1", style: {
                                backgroundColor: hoveredButton === 'toggle' ? theme.colors.background : 'transparent'
                            }, onMouseEnter: () => setHoveredButton('toggle'), onMouseLeave: () => setHoveredButton(null), title: enabled ? 'Disable hook' : 'Enable hook', children: [enabled ? (_jsx(ToggleRight, { size: 20, className: "text-green-500" })) : (_jsx(ToggleLeft, { size: 20, style: { color: theme.colors.textSecondary } })), _jsx("span", { className: "text-xs ml-1", style: { color: theme.colors.textSecondary }, children: enabled ? 'On' : 'Off' })] })), _jsxs("button", { onClick: onEdit, className: "p-2 rounded transition-colors flex items-center gap-1", style: {
                                backgroundColor: hoveredButton === 'configure' ? theme.colors.background : 'transparent'
                            }, onMouseEnter: () => setHoveredButton('configure'), onMouseLeave: () => setHoveredButton(null), title: "Configure hook", children: [_jsx(Settings, { size: 16, style: { color: theme.colors.textSecondary } }), _jsx("span", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: "Configure" })] }), _jsx("div", { className: "w-px h-6 mx-1", style: { backgroundColor: theme.colors.border } }), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                const confirmed = window.confirm(`Are you sure you want to remove the hook "${commandName}"?`);
                                if (confirmed) {
                                    onRemove();
                                }
                            }, className: "p-2 rounded hover:bg-red-600/20 transition-colors", title: "Remove hook", children: _jsx(Trash2, { size: 16, className: "text-red-400" }) })] })] }));
    }
    // Grid layout (original)
    return (_jsxs("div", { className: "relative rounded-lg p-4 aspect-square flex flex-col items-center justify-center transition-all group cursor-pointer", style: {
            backgroundColor: showActions ? theme.colors.backgroundHover : theme.colors.surface
        }, onMouseEnter: () => setShowActions(true), onMouseLeave: () => setShowActions(false), onClick: onEdit, children: [_jsx("div", { className: "w-8 h-8 rounded-lg flex items-center justify-center mb-2", style: { backgroundColor: `${color}20` }, children: _jsx("span", { style: { color }, children: fileExtension === 'js' ? (_jsx(Scroll, { size: 20 })) : fileExtension === 'py' ? ('🐍') : (_jsx(FileText, { size: 20 })) }) }), _jsx("p", { className: "text-sm font-medium text-white truncate max-w-full px-2 mb-2", title: commandName, children: commandName }), _jsx("code", { className: "text-xs px-2 py-1 rounded font-mono", style: {
                    backgroundColor: theme.colors.background,
                    color: theme.colors.textTertiary
                }, children: matcher }), _jsx("div", { className: "absolute top-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity", children: _jsxs("div", { className: "flex justify-between", children: [_jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                onEdit();
                            }, className: "p-1 rounded transition-colors", style: {
                                backgroundColor: hoveredButton === 'edit' ? theme.colors.surface : `${theme.colors.background}e6`
                            }, onMouseEnter: () => setHoveredButton('edit'), onMouseLeave: () => setHoveredButton(null), title: "Edit hook", children: _jsx("svg", { className: "w-4 h-4", style: { color: theme.colors.textTertiary }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) }) }), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                onShowInfo();
                            }, className: "p-1 rounded transition-colors", style: {
                                backgroundColor: hoveredButton === 'edit' ? theme.colors.surface : `${theme.colors.background}e6`
                            }, onMouseEnter: () => setHoveredButton('edit'), onMouseLeave: () => setHoveredButton(null), title: "View details", children: _jsx("svg", { className: "w-4 h-4", style: { color: theme.colors.textTertiary }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                onRemove();
                            }, className: "p-1 rounded transition-colors", style: {
                                backgroundColor: hoveredButton === 'remove' ? 'rgba(220, 38, 38, 0.2)' : `${theme.colors.background}e6`
                            }, onMouseEnter: () => setHoveredButton('remove'), onMouseLeave: () => setHoveredButton(null), title: "Remove hook", children: _jsx("svg", { className: "w-4 h-4 text-red-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] }) })] }));
};
