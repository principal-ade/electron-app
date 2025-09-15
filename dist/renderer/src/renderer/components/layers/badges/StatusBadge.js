import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STATUS_CONFIG = {
    monorepo: {
        label: 'Monorepo Root',
        color: '#8B5CF6',
        icon: '📦',
    },
    workspace: {
        label: 'Workspace',
        color: '#10B981',
        icon: '🏢',
    },
    conflict: {
        label: 'Version Conflict',
        color: '#FF9800',
        icon: '⚠️',
    },
    warning: {
        label: 'Warning',
        color: '#FFA726',
        icon: '⚡',
    },
    info: {
        label: 'Info',
        color: '#2196F3',
        icon: 'ℹ️',
    },
};
export const StatusBadge = ({ type, label, size = 'small', }) => {
    const config = STATUS_CONFIG[type];
    const displayLabel = label || config.label;
    const isSmall = size === 'small';
    return (_jsxs("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: isSmall ? '1px 6px' : '2px 8px',
            backgroundColor: `${config.color}20`,
            color: config.color,
            borderRadius: '3px',
            fontSize: isSmall ? '10px' : '11px',
            fontWeight: '500',
        }, children: [_jsx("span", { style: { fontSize: isSmall ? '10px' : '12px' }, children: config.icon }), displayLabel] }));
};
