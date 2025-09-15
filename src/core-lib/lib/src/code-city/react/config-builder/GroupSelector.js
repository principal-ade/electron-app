import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const GroupSelector = ({ rootItems, selectedDirectories, onToggleSelection, onNext, onCancel, isEditing = false, theme, }) => {
    const defaultTheme = {
        colors: {
            primary: '#667eea',
            text: '#1f2937',
            textSecondary: '#6b7280',
            background: '#ffffff',
            backgroundSecondary: '#f9fafb',
            border: '#e5e7eb',
        },
        radius: {
            sm: '4px',
            md: '6px',
        },
        components: {
            button: {
                primary: {
                    backgroundColor: '#667eea',
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                },
                secondary: {
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                },
            },
        },
    };
    const t = theme || defaultTheme;
    return (_jsxs("div", { children: [_jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                }, children: _jsx("h3", { style: { fontSize: '18px', margin: 0 }, children: isEditing ? 'Edit Group Items' : 'Select Items' }) }), _jsx("p", { style: { fontSize: '13px', color: t.colors.textSecondary, marginBottom: '16px' }, children: isEditing
                    ? 'Add or remove items from this group.'
                    : 'Choose directories and files to group together. Items already in groups are shown at the bottom.' }), _jsx("div", { style: {
                    marginBottom: '16px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: `1px solid ${t.colors.border}`,
                    borderRadius: t.radius.md,
                }, children: rootItems.map(item => {
                    if (isEditing && item.isGrouped && !selectedDirectories.has(item.path)) {
                        return null;
                    }
                    return (_jsxs("div", { onClick: () => (!item.isGrouped || isEditing ? onToggleSelection(item.path) : null), style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            cursor: !item.isGrouped || isEditing ? 'pointer' : 'not-allowed',
                            backgroundColor: selectedDirectories.has(item.path)
                                ? '#FF00FF30'
                                : item.isGrouped
                                    ? t.colors.backgroundSecondary
                                    : 'transparent',
                            borderLeft: selectedDirectories.has(item.path)
                                ? '3px solid #FF00FF'
                                : '3px solid transparent',
                            transition: 'all 0.2s',
                            borderBottom: `1px solid ${t.colors.border}`,
                            opacity: item.isGrouped && !selectedDirectories.has(item.path) && !isEditing ? 0.5 : 1,
                        }, children: [_jsx("div", { style: {
                                    width: '16px',
                                    height: '16px',
                                    border: `2px solid ${selectedDirectories.has(item.path) ? '#FF00FF' : t.colors.border}`,
                                    borderRadius: '3px',
                                    backgroundColor: selectedDirectories.has(item.path) ? '#FF00FF' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }, children: selectedDirectories.has(item.path) && (_jsx("div", { style: {
                                        width: '6px',
                                        height: '6px',
                                        backgroundColor: t.colors.background,
                                        borderRadius: '1px',
                                    } })) }), _jsxs("div", { style: {
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: item.type === 'directory' ? t.colors.primary : t.colors.text,
                                }, children: [item.type === 'directory' ? '📁' : '📄', " ", item.name] }), item.isGrouped && !selectedDirectories.has(item.path) && !isEditing && (_jsx("span", { style: {
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    backgroundColor: t.colors.primary,
                                    color: t.colors.background,
                                    borderRadius: t.radius.sm,
                                    marginLeft: '8px',
                                }, children: "GROUPED" })), _jsx("div", { style: {
                                    marginLeft: 'auto',
                                    fontSize: '11px',
                                    color: t.colors.textSecondary,
                                }, children: item.type === 'directory'
                                    ? `${item.size} items`
                                    : `${Math.round(item.size / 1024)}KB` })] }, item.path));
                }) }), selectedDirectories.size > 0 && (_jsxs("div", { style: {
                    marginBottom: '16px',
                    padding: '8px',
                    backgroundColor: t.colors.backgroundSecondary,
                    borderRadius: t.radius.md,
                    fontSize: '12px',
                    color: t.colors.textSecondary,
                }, children: ["Selected ", selectedDirectories.size, " items"] })), _jsx("button", { onClick: onNext, disabled: selectedDirectories.size === 0, style: {
                    ...t.components.button.primary,
                    width: '100%',
                    opacity: selectedDirectories.size === 0 ? 0.5 : 1,
                    cursor: selectedDirectories.size === 0 ? 'not-allowed' : 'pointer',
                }, children: isEditing ? 'Next: Reposition Group' : 'Next: Name Group' }), _jsx("button", { onClick: onCancel, style: {
                    ...t.components.button.secondary,
                    width: '100%',
                    marginTop: '8px',
                }, children: "Cancel" })] }));
};
//# sourceMappingURL=GroupSelector.js.map