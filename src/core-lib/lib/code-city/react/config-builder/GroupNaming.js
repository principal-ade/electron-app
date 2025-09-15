"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupNaming = void 0;
const react_1 = __importDefault(require("react"));
const GroupNaming = ({ selectedCount, currentName, onNameChange, onNext, onBack, theme, }) => {
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
    return (react_1.default.createElement("div", null,
        react_1.default.createElement("div", { style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
            } },
            react_1.default.createElement("h3", { style: { fontSize: '18px', margin: 0 } }, "Name Your Group")),
        react_1.default.createElement("p", { style: { fontSize: '13px', color: t.colors.textSecondary, marginBottom: '16px' } },
            "Give this group of ",
            selectedCount,
            " items a descriptive name."),
        react_1.default.createElement("input", { type: "text", placeholder: "e.g., Core Components, Utils, Tests", value: currentName, onChange: e => onNameChange(e.target.value), style: {
                width: '100%',
                padding: '10px',
                backgroundColor: t.colors.background,
                border: `1px solid ${t.colors.border}`,
                borderRadius: t.radius.sm,
                fontSize: '14px',
                marginBottom: '16px',
                color: t.colors.text,
            }, autoFocus: true }),
        react_1.default.createElement("button", { onClick: onNext, disabled: !currentName, style: {
                ...t.components.button.primary,
                width: '100%',
                opacity: currentName ? 1 : 0.5,
                cursor: currentName ? 'pointer' : 'not-allowed',
            } }, "Next: Choose Position"),
        react_1.default.createElement("button", { onClick: onBack, style: {
                ...t.components.button.secondary,
                width: '100%',
                marginTop: '8px',
            } }, "Back to Selection")));
};
exports.GroupNaming = GroupNaming;
