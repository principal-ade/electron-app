import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { Database, FolderOpen, X, Info } from 'lucide-react';
export const StorageLocationModal = ({ isOpen, onClose, onSelectLocation, title = 'Choose Storage Location for Excalidraw Diagram' }) => {
    const { theme } = useTheme();
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '600px',
                width: '90%',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                border: `1px solid ${theme.colors.border}`
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '20px'
                    }, children: [_jsx("h2", { style: {
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: theme.colors.text
                            }, children: title }), _jsx("button", { onClick: onClose, style: {
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: theme.colors.textSecondary
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: {
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '20px'
                    }, children: [_jsxs("div", { onClick: () => onSelectLocation('repository'), style: {
                                flex: 1,
                                padding: '20px',
                                backgroundColor: theme.colors.backgroundLight,
                                borderRadius: '8px',
                                border: `2px solid transparent`,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.borderColor = theme.colors.primary;
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '12px'
                                    }, children: [_jsx(FolderOpen, { size: 24, color: theme.colors.primary }), _jsx("h3", { style: {
                                                margin: 0,
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                color: theme.colors.text
                                            }, children: "Repository Storage" })] }), _jsxs("p", { style: {
                                        margin: 0,
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.5'
                                    }, children: ["Store the diagram as a ", _jsx("code", { children: ".excalidraw" }), " file in your repository."] }), _jsxs("div", { style: {
                                        marginTop: '12px',
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary
                                    }, children: [_jsx("div", { style: { marginBottom: '4px' }, children: "\u2713 Version controlled with Git" }), _jsx("div", { style: { marginBottom: '4px' }, children: "\u2713 Visible in file explorer" }), _jsx("div", { style: { marginBottom: '4px' }, children: "\u2713 Can be shared with team" }), _jsx("div", { children: "\u2713 Included in repository backups" })] })] }), _jsxs("div", { onClick: () => onSelectLocation('app-data'), style: {
                                flex: 1,
                                padding: '20px',
                                backgroundColor: theme.colors.backgroundLight,
                                borderRadius: '8px',
                                border: `2px solid transparent`,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.borderColor = theme.colors.primary;
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '12px'
                                    }, children: [_jsx(Database, { size: 24, color: theme.colors.primary }), _jsx("h3", { style: {
                                                margin: 0,
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                color: theme.colors.text
                                            }, children: "App Data Storage" })] }), _jsx("p", { style: {
                                        margin: 0,
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.5'
                                    }, children: "Store the diagram in application data, separate from repository." }), _jsxs("div", { style: {
                                        marginTop: '12px',
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary
                                    }, children: [_jsx("div", { style: { marginBottom: '4px' }, children: "\u2713 Doesn't clutter repository" }), _jsx("div", { style: { marginBottom: '4px' }, children: "\u2713 Available across projects" }), _jsx("div", { style: { marginBottom: '4px' }, children: "\u2713 Fast access and loading" }), _jsx("div", { children: "\u2713 Managed by the application" })] })] })] }), _jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px',
                        backgroundColor: `${theme.colors.primary}10`,
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.textSecondary
                    }, children: [_jsx(Info, { size: 16, color: theme.colors.primary }), _jsx("span", { children: "You can change storage location later by saving the diagram to a different location." })] })] }) }));
};
