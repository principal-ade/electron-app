import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export const GridPositioner = ({ gridSize, groups, currentGroupName, onPositionSelect, onBack, isEditing = false, editingGroupId = null, theme, }) => {
    const [hoveredPosition, setHoveredPosition] = useState(null);
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
                }, children: _jsx("h3", { style: { fontSize: '18px', margin: 0 }, children: isEditing ? 'Reposition Group' : 'Place on Grid' }) }), _jsxs("p", { style: { fontSize: '13px', color: t.colors.textSecondary, marginBottom: '16px' }, children: ["Click where you want to ", isEditing ? 'move' : 'place', " \"", currentGroupName, "\" on the grid."] }), _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.max(3, gridSize.cols + 1)}, 1fr)`,
                    gridTemplateRows: `repeat(${Math.max(3, gridSize.rows + 1)}, 1fr)`,
                    gap: '4px',
                    aspectRatio: '1',
                    marginBottom: '16px',
                }, children: Array.from({
                    length: Math.max(3, gridSize.rows + 1) * Math.max(3, gridSize.cols + 1),
                }).map((_, i) => {
                    const row = Math.floor(i / Math.max(3, gridSize.cols + 1)) + 1;
                    const col = (i % Math.max(3, gridSize.cols + 1)) + 1;
                    const isOccupied = groups.some(g => g.position?.row === row && g.position?.col === col);
                    const occupyingGroup = groups.find(g => g.position?.row === row && g.position?.col === col);
                    return (_jsxs("button", { onClick: () => {
                            if (!isOccupied || (isEditing && occupyingGroup?.id === editingGroupId)) {
                                onPositionSelect(row, col);
                            }
                        }, disabled: isOccupied && (!isEditing || occupyingGroup?.id !== editingGroupId), style: {
                            aspectRatio: '1',
                            border: `2px ${isOccupied ? 'solid' : 'dashed'} ${isOccupied ? occupyingGroup?.color : t.colors.border}`,
                            backgroundColor: isOccupied ? `${occupyingGroup?.color}20` : t.colors.background,
                            borderRadius: t.radius.sm,
                            cursor: isOccupied && (!isEditing || occupyingGroup?.id !== editingGroupId)
                                ? 'not-allowed'
                                : 'pointer',
                            position: 'relative',
                            transition: 'all 0.2s',
                            opacity: isOccupied ? 0.7 : 1,
                        }, onMouseEnter: () => !isOccupied && setHoveredPosition({ row, col }), onMouseLeave: () => setHoveredPosition(null), children: [isOccupied && (_jsx("span", { style: { fontSize: '10px', fontWeight: '600' }, children: occupyingGroup?.name })), !isOccupied && hoveredPosition?.row === row && hoveredPosition?.col === col && (_jsx("span", { style: { fontSize: '10px', color: t.colors.primary }, children: "+" }))] }, i));
                }) }), _jsx("button", { onClick: onBack, style: {
                    ...t.components.button.secondary,
                    width: '100%',
                }, children: "Back to Naming" })] }));
};
