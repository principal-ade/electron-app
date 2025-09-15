import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const ModeSwitch = ({ mode, onModeChange, hasLocalClones, disabled = false }) => {
    const { theme } = useTheme();
    // Define the modes available based on whether we have local clones
    const modes = hasLocalClones
        ? [
            { value: 'explore', label: 'Explore' },
            { value: 'planning', label: 'Plan' },
            { value: 'develop', label: 'Develop' },
            { value: 'maintain', label: 'Maintain' }
        ]
        : [
            { value: 'explore', label: 'Explore' }
        ];
    // Get the index of the current mode
    const currentIndex = modes.findIndex(m => m.value === mode);
    // Calculate the slider position
    const sliderWidth = hasLocalClones ? `${100 / modes.length}%` : '100%';
    const sliderLeft = hasLocalClones ? `${(currentIndex * 100) / modes.length}%` : '0%';
    // If only one mode available (Explore for remote-only), render a simpler version
    if (!hasLocalClones) {
        return (_jsx("div", { style: {
                display: 'inline-flex',
                padding: '3px',
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                position: 'relative',
            }, children: _jsx("div", { style: {
                    padding: '5px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: theme.colors.primary,
                    backgroundColor: theme.colors.background,
                    borderRadius: '5px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    cursor: 'default',
                    minWidth: '70px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }, children: "Explore" }) }));
    }
    return (_jsxs("div", { style: {
            display: 'inline-flex',
            padding: '3px',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            position: 'relative',
            gap: '2px',
            flexShrink: 0,
        }, children: [_jsx("div", { style: {
                    position: 'absolute',
                    top: '3px',
                    left: sliderLeft,
                    width: sliderWidth,
                    height: 'calc(100% - 6px)',
                    backgroundColor: theme.colors.background,
                    borderRadius: '5px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1,
                } }), modes.map((modeOption) => (_jsx("button", { onClick: () => !disabled && onModeChange?.(modeOption.value), disabled: disabled, style: {
                    padding: '5px 14px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: mode === modeOption.value ? theme.colors.primary : theme.colors.textSecondary,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'color 0.3s',
                    position: 'relative',
                    zIndex: 2,
                    whiteSpace: 'nowrap',
                    minWidth: '70px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }, onMouseEnter: (e) => {
                    if (!disabled && mode !== modeOption.value) {
                        e.currentTarget.style.color = theme.colors.text;
                    }
                }, onMouseLeave: (e) => {
                    if (!disabled && mode !== modeOption.value) {
                        e.currentTarget.style.color = theme.colors.textSecondary;
                    }
                }, children: modeOption.label }, modeOption.value)))] }));
};
