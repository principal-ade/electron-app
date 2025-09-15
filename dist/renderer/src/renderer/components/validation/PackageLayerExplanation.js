import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { Package } from 'lucide-react';
export const PackageLayerExplanation = ({ packagePath, validationName, onClose }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: theme.colors.backgroundLight,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '600px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            zIndex: 1000,
        }, children: [onClose && (_jsx("button", { onClick: onClose, style: {
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1,
                }, children: "\u00D7" })), _jsx("h3", { style: {
                    margin: '0 0 24px 0',
                    fontSize: '20px',
                    fontWeight: '600',
                    color: theme.colors.text,
                }, children: "Understanding Validation Layers" }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '24px',
                    marginBottom: '32px',
                    padding: '24px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                }, children: [_jsxs("div", { style: {
                            textAlign: 'center',
                        }, children: [_jsx("div", { style: {
                                    fontSize: '48px',
                                    marginBottom: '8px',
                                }, children: _jsx(Package, { size: 48 }) }), _jsx("div", { style: {
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: theme.colors.text,
                                    marginBottom: '4px',
                                }, children: "Package Layer" }), _jsx("code", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                }, children: packagePath || 'root' })] }), _jsx("div", { style: {
                            fontSize: '24px',
                            color: theme.colors.textSecondary,
                        }, children: "+" }), _jsxs("div", { style: {
                            textAlign: 'center',
                        }, children: [_jsx("div", { style: {
                                    fontSize: '48px',
                                    marginBottom: '8px',
                                }, children: "\uD83D\uDEE0\uFE0F" }), _jsx("div", { style: {
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: theme.colors.text,
                                    marginBottom: '4px',
                                }, children: "Validation" }), _jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                }, children: validationName })] }), _jsx("div", { style: {
                            fontSize: '24px',
                            color: theme.colors.textSecondary,
                        }, children: "=" }), _jsxs("div", { style: {
                            textAlign: 'center',
                        }, children: [_jsx("div", { style: {
                                    fontSize: '48px',
                                    marginBottom: '8px',
                                }, children: "\u2713" }), _jsx("div", { style: {
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: theme.colors.primary,
                                    marginBottom: '4px',
                                }, children: "Validation Layer" }), _jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                }, children: "Configured & Active" })] })] }), _jsxs("div", { style: {
                    marginBottom: '24px',
                }, children: [_jsx("h4", { style: {
                            margin: '0 0 12px 0',
                            fontSize: '16px',
                            fontWeight: '600',
                            color: theme.colors.text,
                        }, children: "What does this mean?" }), _jsxs("p", { style: {
                            margin: '0 0 12px 0',
                            fontSize: '14px',
                            color: theme.colors.textSecondary,
                            lineHeight: 1.6,
                        }, children: ["A ", _jsx("strong", { children: "Validation Layer" }), " is created when you configure a validation tool for a specific package in your project."] }), _jsxs("ul", { style: {
                            margin: 0,
                            paddingLeft: '24px',
                            fontSize: '14px',
                            color: theme.colors.textSecondary,
                            lineHeight: 1.8,
                        }, children: [_jsxs("li", { children: ["The ", _jsx("strong", { children: "Package Layer" }), " represents a directory in your project that contains a package.json file"] }), _jsxs("li", { children: ["The ", _jsx("strong", { children: "Validation" }), " is the tool (like ESLint, TypeScript, Jest) that checks your code"] }), _jsxs("li", { children: ["When combined, they create a ", _jsx("strong", { children: "Validation Layer" }), " that runs checks on that specific package"] })] })] }), _jsxs("div", { style: {
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    lineHeight: 1.6,
                }, children: [_jsx("strong", { children: "Example:" }), " If you have a monorepo with multiple packages, each package can have its own validation layers. A package at", ' ', _jsx("code", { style: {
                            backgroundColor: theme.colors.backgroundTertiary,
                            padding: '2px 4px',
                            borderRadius: '2px',
                        }, children: "packages/ui" }), ' ', "might have ESLint and TypeScript validations, while", ' ', _jsx("code", { style: {
                            backgroundColor: theme.colors.backgroundTertiary,
                            padding: '2px 4px',
                            borderRadius: '2px',
                        }, children: "packages/api" }), ' ', "might have Jest and TSDoc validations."] })] }));
};
