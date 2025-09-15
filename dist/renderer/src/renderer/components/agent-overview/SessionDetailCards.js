import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const FileActionButtons = ({ fileFilter, createdFiles, deletedFiles, largeFiles, onFilterChange, }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
        }, children: [_jsxs("button", { onClick: () => onFilterChange('created'), style: {
                    backgroundColor: `${theme.colors.success}20`,
                    border: `1px solid ${theme.colors.success}80`,
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    width: '100%',
                    cursor: 'pointer',
                    boxShadow: fileFilter === 'created'
                        ? `0 0 0 2px ${theme.colors.success}`
                        : 'none',
                }, onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = `${theme.colors.success}30`), onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = `${theme.colors.success}20`), children: [_jsx("p", { style: {
                            color: theme.colors.success,
                            fontSize: '14px',
                            margin: '0 0 4px 0',
                        }, children: "Created Files" }), _jsx("p", { style: {
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: theme.colors.text,
                            margin: 0,
                        }, children: createdFiles })] }), _jsxs("button", { onClick: () => onFilterChange('deleted'), style: {
                    backgroundColor: `${theme.colors.error}20`,
                    border: `1px solid ${theme.colors.error}80`,
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    width: '100%',
                    cursor: 'pointer',
                    boxShadow: fileFilter === 'deleted'
                        ? `0 0 0 2px ${theme.colors.error}`
                        : 'none',
                }, onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = `${theme.colors.error}30`), onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = `${theme.colors.error}20`), children: [_jsx("p", { style: {
                            color: theme.colors.error,
                            fontSize: '14px',
                            margin: '0 0 4px 0',
                        }, children: "Deleted Files" }), _jsx("p", { style: {
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: theme.colors.text,
                            margin: 0,
                        }, children: deletedFiles })] }), _jsxs("button", { onClick: () => onFilterChange('large'), style: {
                    backgroundColor: `${theme.colors.warning}20`,
                    border: `1px solid ${theme.colors.warning}80`,
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    width: '100%',
                    cursor: 'pointer',
                    boxShadow: fileFilter === 'large'
                        ? `0 0 0 2px ${theme.colors.warning}`
                        : 'none',
                }, onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = `${theme.colors.warning}30`), onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = `${theme.colors.warning}20`), children: [_jsx("p", { style: {
                            color: theme.colors.warning,
                            fontSize: '14px',
                            margin: '0 0 4px 0',
                        }, children: "Large Files" }), _jsx("p", { style: {
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: theme.colors.text,
                            margin: 0,
                        }, children: largeFiles })] })] }));
};
export const ToolStatsCards = ({ totalCalls, uniqueTools, }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
        }, children: [_jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '8px',
                    padding: '12px',
                }, children: [_jsx("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 4px 0',
                        }, children: "Total Calls" }), _jsx("p", { style: {
                            fontSize: '18px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            margin: 0,
                        }, children: totalCalls })] }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '8px',
                    padding: '12px',
                }, children: [_jsx("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 4px 0',
                        }, children: "Unique Tools" }), _jsx("p", { style: {
                            fontSize: '18px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            margin: 0,
                        }, children: uniqueTools })] })] }));
};
export const ToolUsageCard = ({ toolCounts }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            backgroundColor: theme.colors.backgroundTertiary,
            padding: '12px',
        }, children: [_jsx("h3", { style: {
                    fontWeight: 500,
                    marginBottom: '8px',
                    color: theme.colors.text,
                    fontSize: '14px',
                }, children: "Tool Usage" }), _jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                }, children: Object.entries(toolCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([toolName, count]) => (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '4px',
                        padding: '8px',
                    }, children: [_jsx("span", { style: {
                                fontFamily: theme.fonts.monospace,
                                fontSize: '13px',
                                color: theme.colors.text,
                            }, children: toolName }), _jsx("span", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: count })] }, toolName))) })] }));
};
export const RecentToolCallsCard = ({ toolCalls, }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            backgroundColor: theme.colors.backgroundTertiary,
            padding: '16px',
        }, children: [_jsx("h3", { style: {
                    fontWeight: 500,
                    marginBottom: '12px',
                    color: theme.colors.text,
                }, children: "Recent Calls" }), _jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '384px',
                    overflowY: 'auto',
                }, children: toolCalls
                    .slice(-20)
                    .reverse()
                    .map((toolCall, index) => (_jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '4px',
                        padding: '12px',
                    }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '4px',
                            }, children: [_jsx("span", { style: {
                                        fontFamily: theme.fonts.monospace,
                                        fontSize: '14px',
                                        color: theme.colors.text,
                                    }, children: toolCall.toolName }), _jsx("span", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                    }, children: new Date(toolCall.timestamp).toLocaleTimeString() })] }), toolCall.parameters &&
                            Object.keys(toolCall.parameters).length > 0 && (_jsx("div", { style: {
                                fontSize: '12px',
                                color: theme.colors.textSecondary,
                            }, children: Object.entries(toolCall.parameters).map(([key, value]) => (_jsxs("div", { style: { marginTop: '4px' }, children: [_jsxs("span", { style: { color: theme.colors.textTertiary }, children: [key, ":"] }), ' ', _jsx("span", { style: { color: theme.colors.textSecondary }, children: JSON.stringify(value).substring(0, 100) })] }, key))) }))] }, index))) })] }));
};
export const KnipAnalysisStats = ({ unusedFiles, unusedExports, unusedDependencies, unresolvedImports, }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
        }, children: [_jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    padding: '12px',
                }, children: [_jsx("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 4px 0',
                        }, children: "Unused Files" }), _jsx("p", { style: {
                            fontSize: '18px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            margin: 0,
                        }, children: unusedFiles })] }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    padding: '12px',
                }, children: [_jsx("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 4px 0',
                        }, children: "Unused Exports" }), _jsx("p", { style: {
                            fontSize: '18px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            margin: 0,
                        }, children: unusedExports })] }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    padding: '12px',
                }, children: [_jsx("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 4px 0',
                        }, children: "Unused Dependencies" }), _jsx("p", { style: {
                            fontSize: '18px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            margin: 0,
                        }, children: unusedDependencies })] }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                    padding: '12px',
                }, children: [_jsx("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 4px 0',
                        }, children: "Unresolved Imports" }), _jsx("p", { style: {
                            fontSize: '18px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            margin: 0,
                        }, children: unresolvedImports })] })] }));
};
