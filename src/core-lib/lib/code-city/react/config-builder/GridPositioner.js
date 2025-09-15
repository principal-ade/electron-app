"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridPositioner = void 0;
const react_1 = __importStar(require("react"));
const GridPositioner = ({ gridSize, groups, currentGroupName, onPositionSelect, onBack, isEditing = false, editingGroupId = null, theme, }) => {
    const [hoveredPosition, setHoveredPosition] = (0, react_1.useState)(null);
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
    return (react_1.default.createElement("div", null,
        react_1.default.createElement("div", { style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
            } },
            react_1.default.createElement("h3", { style: { fontSize: '18px', margin: 0 } }, isEditing ? 'Reposition Group' : 'Place on Grid')),
        react_1.default.createElement("p", { style: { fontSize: '13px', color: t.colors.textSecondary, marginBottom: '16px' } },
            "Click where you want to ",
            isEditing ? 'move' : 'place',
            " \"",
            currentGroupName,
            "\" on the grid."),
        react_1.default.createElement("div", { style: {
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(3, gridSize.cols + 1)}, 1fr)`,
                gridTemplateRows: `repeat(${Math.max(3, gridSize.rows + 1)}, 1fr)`,
                gap: '4px',
                aspectRatio: '1',
                marginBottom: '16px',
            } }, Array.from({
            length: Math.max(3, gridSize.rows + 1) * Math.max(3, gridSize.cols + 1),
        }).map((_, i) => {
            const row = Math.floor(i / Math.max(3, gridSize.cols + 1)) + 1;
            const col = (i % Math.max(3, gridSize.cols + 1)) + 1;
            const isOccupied = groups.some(g => g.position?.row === row && g.position?.col === col);
            const occupyingGroup = groups.find(g => g.position?.row === row && g.position?.col === col);
            return (react_1.default.createElement("button", { key: i, onClick: () => {
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
                }, onMouseEnter: () => !isOccupied && setHoveredPosition({ row, col }), onMouseLeave: () => setHoveredPosition(null) },
                isOccupied && (react_1.default.createElement("span", { style: { fontSize: '10px', fontWeight: '600' } }, occupyingGroup?.name)),
                !isOccupied && hoveredPosition?.row === row && hoveredPosition?.col === col && (react_1.default.createElement("span", { style: { fontSize: '10px', color: t.colors.primary } }, "+"))));
        })),
        react_1.default.createElement("button", { onClick: onBack, style: {
                ...t.components.button.secondary,
                width: '100%',
            } }, "Back to Naming")));
};
exports.GridPositioner = GridPositioner;
