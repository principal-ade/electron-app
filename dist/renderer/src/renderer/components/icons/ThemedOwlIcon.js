import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const ThemedOwlIcon = ({ size = 48, className, eyeColor, bodyColor, accentColor }) => {
    const { theme } = useTheme();
    // Use theme colors or overrides
    const colors = {
        eye: eyeColor || theme.colors.primary,
        eyeGlow: theme.colors.accent,
        body: bodyColor || theme.colors.textSecondary,
        bodyLight: theme.colors.textTertiary,
        accent: accentColor || theme.colors.accent,
        beak: theme.colors.warning,
        feet: theme.colors.textMuted,
        // For dark themes, we might want lighter body colors
        bodyStroke: theme.colors.border,
        highlight: theme.colors.backgroundLight
    };
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 100 100", className: className, xmlns: "http://www.w3.org/2000/svg", style: { display: 'block' }, children: [_jsxs("defs", { children: [_jsxs("radialGradient", { id: `eye-gradient-${theme.colors.primary}`, children: [_jsx("stop", { offset: "0%", stopColor: colors.eyeGlow, stopOpacity: "0.8" }), _jsx("stop", { offset: "50%", stopColor: colors.eye }), _jsx("stop", { offset: "100%", stopColor: colors.eye, stopOpacity: "0.9" })] }), _jsxs("linearGradient", { id: `body-gradient-${theme.colors.textSecondary}`, x1: "0%", y1: "0%", x2: "0%", y2: "100%", children: [_jsx("stop", { offset: "0%", stopColor: colors.bodyLight }), _jsx("stop", { offset: "100%", stopColor: colors.body })] }), _jsxs("filter", { id: "eye-glow", children: [_jsx("feGaussianBlur", { stdDeviation: "2", result: "coloredBlur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "coloredBlur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] })] }), _jsx("ellipse", { cx: "50", cy: "60", rx: "30", ry: "35", fill: `url(#body-gradient-${theme.colors.textSecondary})`, stroke: colors.bodyStroke, strokeWidth: "1" }), _jsx("circle", { cx: "50", cy: "35", r: "25", fill: `url(#body-gradient-${theme.colors.textSecondary})`, stroke: colors.bodyStroke, strokeWidth: "1" }), _jsx("path", { d: "M 30 20 L 25 10 L 35 15 Z", fill: colors.body, stroke: colors.bodyStroke, strokeWidth: "0.5" }), _jsx("path", { d: "M 70 20 L 75 10 L 65 15 Z", fill: colors.body, stroke: colors.bodyStroke, strokeWidth: "0.5" }), _jsx("circle", { cx: "38", cy: "35", r: "10", fill: colors.highlight, stroke: colors.bodyStroke, strokeWidth: "0.5" }), _jsx("circle", { cx: "62", cy: "35", r: "10", fill: colors.highlight, stroke: colors.bodyStroke, strokeWidth: "0.5" }), _jsx("circle", { cx: "38", cy: "35", r: "7", fill: `url(#eye-gradient-${theme.colors.primary})`, filter: "url(#eye-glow)", style: {
                    transition: 'fill 0.3s ease'
                } }), _jsx("circle", { cx: "62", cy: "35", r: "7", fill: `url(#eye-gradient-${theme.colors.primary})`, filter: "url(#eye-glow)", style: {
                    transition: 'fill 0.3s ease'
                } }), _jsx("circle", { cx: "38", cy: "35", r: "3", fill: "#000000" }), _jsx("circle", { cx: "62", cy: "35", r: "3", fill: "#000000" }), _jsx("circle", { cx: "40", cy: "33", r: "1.5", fill: "#FFFFFF", opacity: "0.8" }), _jsx("circle", { cx: "64", cy: "33", r: "1.5", fill: "#FFFFFF", opacity: "0.8" }), _jsx("path", { d: "M 50 40 L 45 45 L 50 48 L 55 45 Z", fill: colors.beak, stroke: colors.bodyStroke, strokeWidth: "0.5" }), _jsx("ellipse", { cx: "25", cy: "60", rx: "10", ry: "20", fill: colors.body, stroke: colors.bodyStroke, strokeWidth: "0.5", transform: "rotate(-15 25 60)" }), _jsx("ellipse", { cx: "75", cy: "60", rx: "10", ry: "20", fill: colors.body, stroke: colors.bodyStroke, strokeWidth: "0.5", transform: "rotate(15 75 60)" }), _jsx("path", { d: "M 40 85 L 40 92 M 35 92 L 45 92", stroke: colors.feet, strokeWidth: "2", strokeLinecap: "round" }), _jsx("path", { d: "M 60 85 L 60 92 M 55 92 L 65 92", stroke: colors.feet, strokeWidth: "2", strokeLinecap: "round" })] }));
};
