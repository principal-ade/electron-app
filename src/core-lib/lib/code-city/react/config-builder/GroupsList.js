"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupsList = void 0;
const react_1 = __importDefault(require("react"));
const GroupsList = ({ groups, onEditGroup, onMoveGroup, onDeleteGroup, theme, }) => {
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
    return (react_1.default.createElement("div", { style: {
            padding: '1.5rem',
            backgroundColor: t.colors.backgroundSecondary,
            borderRadius: t.radius.lg,
            border: `1px solid ${t.colors.border}`,
        } },
        react_1.default.createElement("h4", { style: { fontSize: '16px', marginBottom: '12px' } },
            "Groups (",
            groups.length,
            ")"),
        react_1.default.createElement("div", { style: { fontSize: '13px' } }, groups.map(group => (react_1.default.createElement("div", { key: group.id, style: {
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: t.colors.background,
                borderRadius: t.radius.sm,
                borderLeft: `3px solid ${group.color}`,
                position: 'relative',
            } },
            react_1.default.createElement("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                } },
                react_1.default.createElement("div", null,
                    react_1.default.createElement("div", { style: { fontWeight: '600', marginBottom: '4px' } }, group.name),
                    react_1.default.createElement("div", { style: { fontSize: '11px', color: t.colors.textSecondary, marginBottom: '4px' } },
                        "Position: (",
                        group.position?.row,
                        ", ",
                        group.position?.col,
                        ")"),
                    react_1.default.createElement("div", { style: { fontSize: '11px', color: t.colors.textSecondary } },
                        group.files.length,
                        " items")),
                react_1.default.createElement("div", { style: {
                        display: 'flex',
                        gap: '4px',
                    } },
                    react_1.default.createElement("button", { onClick: () => onEditGroup(group.id), title: "Edit group items", style: {
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
                        } }, "\u270F\uFE0F"),
                    react_1.default.createElement("button", { onClick: () => onMoveGroup(group.id), title: "Move group position", style: {
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
                        } }, "\u2194\uFE0F"),
                    react_1.default.createElement("button", { onClick: () => {
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
                        } }, "\uD83D\uDDD1\uFE0F")))))))));
};
exports.GroupsList = GroupsList;
