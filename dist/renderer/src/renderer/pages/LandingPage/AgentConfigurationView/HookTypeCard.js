import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Wrench, StopCircle, Bell, Layers, FileText, Globe, Edit3 } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const HookTypeCard = ({ type, count, configured, color, onClick, description, }) => {
    const { theme } = useTheme();
    const getIcon = () => {
        // Map hook types to appropriate icons
        const iconMap = {
            'Post Tool Use': _jsx(Wrench, { size: 24 }),
            'Pre Tool Use': _jsx(Wrench, { size: 24 }),
            'Stop': _jsx(StopCircle, { size: 24 }),
            'Session Stop': _jsx(StopCircle, { size: 24 }),
            'Subagent Stop': _jsx(StopCircle, { size: 24 }),
            'Notification': _jsx(Bell, { size: 24 }),
            'Pre Compact': _jsx(Layers, { size: 24 }),
            'Tool Call': _jsx(Wrench, { size: 24 }),
            'File Read': _jsx(FileText, { size: 24 }),
            'File Edited': _jsx(Edit3, { size: 24 }),
            'Web Access': _jsx(Globe, { size: 24 }),
        };
        return iconMap[type] || _jsx(Wrench, { size: 24 });
    };
    return (_jsxs("button", { onClick: onClick, className: "rounded-lg p-6 transition-all text-left group relative overflow-hidden", style: {
            backgroundColor: theme.colors.surface,
            //'&:hover': { backgroundColor: theme.colors.backgroundHover }
        }, onMouseEnter: (e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
        }, onMouseLeave: (e) => {
            e.currentTarget.style.backgroundColor = theme.colors.surface;
        }, children: [_jsx("div", { className: "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity", style: {
                    background: `linear-gradient(135deg, ${color} 0%, transparent 100%)`,
                } }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsx("div", { className: "w-12 h-12 rounded-lg flex items-center justify-center", style: { backgroundColor: `${color}20` }, children: _jsx("span", { className: "text-2xl", children: getIcon() }) }), _jsx("div", { className: "text-right", children: configured ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full", style: { backgroundColor: theme.colors.success } }), _jsx("span", { className: "text-sm", style: { color: theme.colors.success }, children: "Configured" })] })) : (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full", style: { backgroundColor: theme.colors.warning } }), _jsx("span", { className: "text-sm", style: { color: theme.colors.warning }, children: "Not configured" })] })) })] }), _jsx("h3", { className: "text-lg font-semibold mb-1", style: { color: theme.colors.text }, children: type }), _jsx("p", { className: "text-sm mb-3", style: { color: theme.colors.textSecondary }, children: description || 'Configure hooks for this event' }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-sm", style: { color: theme.colors.textTertiary }, children: [count, " hook", count !== 1 ? 's' : '', " configured"] }), _jsx("svg", { className: "w-5 h-5 transition-colors", style: { color: theme.colors.textSecondary }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })] })] })] }));
};
