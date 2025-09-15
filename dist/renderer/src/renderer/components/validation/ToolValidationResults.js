import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const ToolValidationResults = ({ results, onClose, }) => {
    const { theme } = useTheme();
    const getStatusIcon = (status) => {
        switch (status) {
            case 'success':
                return '✅';
            case 'failure':
                return '❌';
            case 'warning':
                return '⚠️';
            case 'skipped':
                return '⏭️';
            default:
                return '❓';
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'success':
                return '#4CAF50';
            case 'failure':
                return '#f44336';
            case 'warning':
                return '#ff9800';
            case 'skipped':
                return theme.colors.textSecondary;
            default:
                return theme.colors.text;
        }
    };
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '600px',
            backgroundColor: theme.colors.background,
            borderLeft: `1px solid ${theme.colors.border}`,
            boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInFromRight 0.3s ease-out',
        }, children: [_jsxs("div", { style: {
                    padding: '16px 20px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsx("h3", { style: {
                            margin: 0,
                            fontSize: '18px',
                            fontWeight: '600',
                            color: theme.colors.text,
                        }, children: "Validation Results" }), _jsx("button", { onClick: onClose, style: {
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            color: theme.colors.textSecondary,
                            cursor: 'pointer',
                            padding: '4px',
                            lineHeight: 1,
                        }, children: "\u00D7" })] }), _jsx("div", { style: {
                    padding: '12px 20px',
                    backgroundColor: theme.colors.backgroundLight,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                }, children: results.templateName }), _jsx("div", { style: {
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                }, children: results.results.map((result, index) => (_jsxs("div", { style: {
                        marginBottom: '20px',
                        borderBottom: index < results.results.length - 1
                            ? `1px solid ${theme.colors.border}`
                            : 'none',
                        paddingBottom: '20px',
                    }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '8px',
                            }, children: [_jsx("span", { style: { fontSize: '16px' }, children: getStatusIcon(result.status) }), _jsx("span", { style: {
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: getStatusColor(result.status),
                                    }, children: result.actionId }), result.duration && (_jsxs("span", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                        marginLeft: 'auto',
                                    }, children: [(result.duration / 1000).toFixed(1), "s"] }))] }), (result.output || result.error) && (_jsx("pre", { style: {
                                backgroundColor: theme.colors.backgroundSecondary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                padding: '12px',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                margin: 0,
                                overflow: 'auto',
                                maxHeight: '300px',
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                            }, children: result.error ? (_jsx("span", { style: { color: '#f44336' }, children: result.error })) : (result.output) }))] }, index))) }), _jsx("div", { style: {
                    padding: '16px 20px',
                    borderTop: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight,
                }, children: _jsxs("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '16px',
                        textAlign: 'center',
                    }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '20px', fontWeight: '600', color: '#4CAF50' }, children: results.results.filter((r) => r.status === 'success').length }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Success" })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '20px', fontWeight: '600', color: '#f44336' }, children: results.results.filter((r) => r.status === 'failure').length }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Failed" })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '20px', fontWeight: '600', color: '#ff9800' }, children: results.results.filter((r) => r.status === 'warning').length }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Warnings" })] }), _jsxs("div", { children: [_jsx("div", { style: {
                                        fontSize: '20px',
                                        fontWeight: '600',
                                        color: theme.colors.textSecondary,
                                    }, children: results.results.filter((r) => r.status === 'skipped').length }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Skipped" })] })] }) })] }));
};
