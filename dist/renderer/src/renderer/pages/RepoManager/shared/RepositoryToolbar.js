import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
export const RepositoryToolbar = ({ items, position = 'top', expanded = false, }) => {
    const { theme } = useTheme();
    const [hoveredItem, setHoveredItem] = useState(null);
    const activeItems = items.filter(item => item.active);
    const hasActiveItems = activeItems.length > 0;
    if (items.length === 0) {
        return null;
    }
    if (!expanded) {
        return null;
    }
    return (_jsx("div", { style: {
            borderTop: position === 'bottom' ? `1px solid ${theme.colors.border}` : undefined,
            borderBottom: position === 'top' ? `1px solid ${theme.colors.border}` : undefined,
            backgroundColor: theme.colors.background,
            transition: 'all 0.2s ease',
        }, children: _jsx("div", { style: {
                padding: '8px 12px',
            }, children: _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '6px',
                }, children: items.map(item => (_jsxs("button", { onClick: item.onClick, onMouseEnter: () => setHoveredItem(item.id), onMouseLeave: () => setHoveredItem(null), style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: item.active
                            ? 'none'
                            : `1px solid ${theme.colors.border}`,
                        backgroundColor: item.active
                            ? (item.color || theme.colors.primary) + '22'
                            : hoveredItem === item.id
                                ? theme.colors.backgroundTertiary
                                : theme.colors.background,
                        color: item.active
                            ? (item.color || theme.colors.primary)
                            : theme.colors.text,
                        fontSize: '12px',
                        fontWeight: item.active ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                    }, title: item.tooltip || `Toggle ${item.label}`, children: [React.cloneElement(item.icon, { size: 14 }), _jsx("span", { style: { flex: 1, textAlign: 'left' }, children: item.label }), item.count !== undefined && (_jsx("span", { style: {
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: item.active
                                    ? (item.color || theme.colors.primary) + '33'
                                    : theme.colors.backgroundTertiary,
                                fontSize: '10px',
                                fontWeight: 600,
                            }, children: item.count })), item.active && (_jsx("div", { style: {
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                backgroundColor: item.color || theme.colors.primary,
                            } }))] }, item.id))) }) }) }));
};
