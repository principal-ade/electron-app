import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const WizardStep = ({ icon, title, titleColor, description, children, iconBackgroundColor, dataTour, }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { className: "text-center", "data-tour": dataTour, children: [_jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center", style: {
                            backgroundColor: iconBackgroundColor || theme.colors.backgroundSecondary,
                        }, children: icon }), _jsx("h3", { className: "text-xl font-semibold mb-2", style: { color: titleColor || theme.colors.text }, children: title }), _jsx("p", { style: { color: theme.colors.textSecondary, height: '48px' }, children: description })] }), _jsx("div", { style: { minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: children })] }));
};
