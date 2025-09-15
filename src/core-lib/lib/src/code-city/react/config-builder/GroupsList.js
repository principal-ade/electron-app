import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export const GroupsList = ({ groups, onEditGroup, onMoveGroup, onDeleteGroup, theme, }) => {
    const defaultTheme = {
        colors: {
            text: '#1f2937',
            textSecondary: '#6b7280',
            background: '#ffffff',
            backgroundSecondary: '#f9fafb',
            border: '#e5e7eb',
        },
        radius: {
            sm: '4px',
            lg: '8px',
        },
    };
    const t = theme || defaultTheme;
    if (groups.length === 0) {
        return null;
    }
    return (_jsxs("div", { style: {
            padding: '1.5rem',
            backgroundColor: t.colors.backgroundSecondary,
            borderRadius: t.radius.lg,
            border: `1px solid ${t.colors.border}`,
        }, children: [_jsxs("h4", { style: { fontSize: '16px', marginBottom: '12px' }, children: ["Groups (", groups.length, ")"] }), _jsx("div", { style: { fontSize: '13px' }, children: groups.map(group => (_jsx("div", { style: {
                        padding: '12px',
                        marginBottom: '8px',
                        backgroundColor: t.colors.background,
                        borderRadius: t.radius.sm,
                        borderLeft: `3px solid ${group.color}`,
                        position: 'relative',
                    }, children: _jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                        }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: '600', marginBottom: '4px' }, children: group.name }), _jsxs("div", { style: { fontSize: '11px', color: t.colors.textSecondary, marginBottom: '4px' }, children: ["Position: (", group.position?.row, ", ", group.position?.col, ")"] }), _jsxs("div", { style: { fontSize: '11px', color: t.colors.textSecondary }, children: [group.files.length, " items"] })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    gap: '4px',
                                }, children: [_jsx("button", { onClick: () => onEditGroup(group.id), title: "Edit group items", style: {
                                            padding: '4px',
                                            backgroundColor: 'transparent',
                                            border: `1px solid ${t.colors.border}`,
                                            borderRadius: t.radius.sm,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                        }, onMouseEnter: e => {
                                            e.currentTarget.style.backgroundColor = t.colors.backgroundSecondary;
                                        }, onMouseLeave: e => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }, children: "\u270F\uFE0F" }), _jsx("button", { onClick: () => onMoveGroup(group.id), title: "Move group position", style: {
                                            padding: '4px',
                                            backgroundColor: 'transparent',
                                            border: `1px solid ${t.colors.border}`,
                                            borderRadius: t.radius.sm,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                        }, onMouseEnter: e => {
                                            e.currentTarget.style.backgroundColor = t.colors.backgroundSecondary;
                                        }, onMouseLeave: e => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }, children: "\u2194\uFE0F" }), _jsx("button", { onClick: () => {
                                            if (confirm(`Delete group "${group.name}"?`)) {
                                                onDeleteGroup(group.id);
                                            }
                                        }, title: "Delete group", style: {
                                            padding: '4px',
                                            backgroundColor: 'transparent',
                                            border: `1px solid ${t.colors.border}`,
                                            borderRadius: t.radius.sm,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            color: t.colors.text,
                                        }, onMouseEnter: e => {
                                            e.currentTarget.style.backgroundColor = '#fef2f2';
                                            e.currentTarget.style.borderColor = '#fecaca';
                                            e.currentTarget.style.color = '#dc2626';
                                        }, onMouseLeave: e => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.borderColor = t.colors.border;
                                            e.currentTarget.style.color = t.colors.text;
                                        }, children: "\uD83D\uDDD1\uFE0F" })] })] }) }, group.id))) })] }));
};
//# sourceMappingURL=GroupsList.js.map