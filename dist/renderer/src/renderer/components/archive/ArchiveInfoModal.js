import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X, ChevronRight, FolderOpen, Archive, Clock, HardDrive } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { APP_BRANDING } from '../../shared/config/appBranding';
export const ArchiveInfoModal = ({ isOpen, onClose }) => {
    const { theme } = useTheme();
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background || theme.colors.backgroundPrimary,
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '700px',
                maxHeight: '85vh',
                overflow: 'auto',
                border: `1px solid ${theme.colors.border}`,
                position: 'relative',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
            }, children: [_jsx("button", { onClick: onClose, style: {
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }, onMouseEnter: (e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }, onMouseLeave: (e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }, children: _jsx(X, { size: 20, color: theme.colors.textSecondary }) }), _jsxs("h2", { style: {
                        fontSize: '18px',
                        fontWeight: 600,
                        color: theme.colors.text,
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }, children: [_jsx(Archive, { size: 20 }), "Session Archiving & Storage"] }), _jsx("div", { style: {
                        padding: '16px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }, children: _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                        }, children: [_jsxs("div", { style: {
                                    textAlign: 'center',
                                    flex: 1,
                                }, children: [_jsx("div", { style: {
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '8px',
                                            backgroundColor: theme.colors.backgroundPrimary,
                                            border: `2px solid ${theme.colors.primary}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 8px',
                                        }, children: _jsx(FolderOpen, { size: 24, color: theme.colors.primary }) }), _jsx("div", { style: { fontWeight: 600, color: theme.colors.text }, children: "Active Sessions" }), _jsx("div", { style: { fontSize: '10px', color: theme.colors.textSecondary }, children: "In memory" })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px',
                                }, children: [_jsx(Clock, { size: 16, color: theme.colors.warning }), _jsx(ChevronRight, { size: 20, color: theme.colors.textSecondary }), _jsx("span", { style: { fontSize: '10px', color: theme.colors.textSecondary }, children: "24h inactive" })] }), _jsxs("div", { style: {
                                    textAlign: 'center',
                                    flex: 1,
                                }, children: [_jsx("div", { style: {
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '8px',
                                            backgroundColor: theme.colors.backgroundPrimary,
                                            border: `2px solid ${theme.colors.accent}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 8px',
                                        }, children: _jsx(Archive, { size: 24, color: theme.colors.accent }) }), _jsx("div", { style: { fontWeight: 600, color: theme.colors.text }, children: "Archived" }), _jsx("div", { style: { fontSize: '10px', color: theme.colors.textSecondary }, children: "On disk" })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px',
                                }, children: [_jsx(Clock, { size: 16, color: theme.colors.error }), _jsx(ChevronRight, { size: 20, color: theme.colors.textSecondary }), _jsx("span", { style: { fontSize: '10px', color: theme.colors.textSecondary }, children: "30 days" })] }), _jsxs("div", { style: {
                                    textAlign: 'center',
                                    flex: 1,
                                }, children: [_jsx("div", { style: {
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '8px',
                                            backgroundColor: theme.colors.backgroundPrimary,
                                            border: `2px solid ${theme.colors.error}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 8px',
                                            opacity: 0.6,
                                        }, children: _jsx(X, { size: 24, color: theme.colors.error }) }), _jsx("div", { style: { fontWeight: 600, color: theme.colors.text }, children: "Deleted" }), _jsx("div", { style: { fontSize: '10px', color: theme.colors.textSecondary }, children: "Permanent" })] })] }) }), _jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                    }, children: [_jsxs("div", { children: [_jsx("h3", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.primary,
                                        marginBottom: '8px',
                                    }, children: "When Sessions Are Archived" }), _jsxs("p", { style: {
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.5',
                                    }, children: ["Sessions move from active memory to disk storage when:", _jsxs("ul", { style: { marginTop: '8px', paddingLeft: '20px' }, children: [_jsxs("li", { children: [_jsx("strong", { children: "Session ends:" }), " Stop event received + 5 second delay"] }), _jsxs("li", { children: [_jsx("strong", { children: "Inactivity timeout:" }), " No events for 24 hours (configurable)"] }), _jsxs("li", { children: [_jsx("strong", { children: "Manual trigger:" }), " \"Archive All\" button in settings"] }), _jsxs("li", { children: [_jsx("strong", { children: "Storage pressure:" }), " When approaching storage limits"] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.primary,
                                        marginBottom: '8px',
                                    }, children: "Archive Storage Structure" }), _jsx("p", { style: {
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.5',
                                    }, children: _jsxs("div", { style: { marginTop: '12px' }, children: [_jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("strong", { style: { color: theme.colors.text }, children: "Archive Location" }), _jsx("code", { style: {
                                                            display: 'block',
                                                            backgroundColor: theme.colors.backgroundSecondary,
                                                            padding: '6px 10px',
                                                            borderRadius: '4px',
                                                            marginTop: '4px',
                                                            fontSize: '12px',
                                                            fontFamily: 'monospace',
                                                        }, children: `~/Library/Application Support/${APP_BRANDING.COMPANY_NAME}/archived-sessions/` })] }), _jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("strong", { style: { color: theme.colors.text }, children: "Directory Structure" }), _jsxs("code", { style: {
                                                            display: 'block',
                                                            backgroundColor: theme.colors.backgroundSecondary,
                                                            padding: '8px 10px',
                                                            borderRadius: '4px',
                                                            marginTop: '4px',
                                                            fontSize: '11px',
                                                            fontFamily: 'monospace',
                                                            lineHeight: '1.6',
                                                        }, children: ["[sessionId]_[YYYY-MM-DD]/", _jsx("br", {}), "\u251C\u2500\u2500 metadata.json     ", _jsx("span", { style: { color: theme.colors.textSecondary }, children: "// Summary & archive info" }), _jsx("br", {}), "\u251C\u2500\u2500 session.json      ", _jsx("span", { style: { color: theme.colors.textSecondary }, children: "// Processed session data" }), _jsx("br", {}), "\u2514\u2500\u2500 raw-events.json   ", _jsx("span", { style: { color: theme.colors.textSecondary }, children: "// Original hook events" })] }), _jsx("span", { style: { fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '4px' }, children: "Each session stored in its own directory for better organization" })] })] }) })] }), _jsxs("div", { children: [_jsx("h3", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.primary,
                                        marginBottom: '8px',
                                    }, children: "What Gets Archived" }), _jsxs("p", { style: {
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.5',
                                    }, children: ["Each archive directory contains:", _jsxs("ul", { style: { marginTop: '8px', paddingLeft: '20px' }, children: [_jsxs("li", { children: [_jsx("strong", { children: "metadata.json:" }), " Session summary, timestamps, and archive info"] }), _jsxs("li", { children: [_jsx("strong", { children: "session.json:" }), " Processed events with enriched data", _jsxs("ul", { style: { marginLeft: '20px', fontSize: '13px', marginTop: '4px' }, children: [_jsx("li", { children: "Normalized events with timestamps" }), _jsx("li", { children: "Session segments and activity counters" }), _jsx("li", { children: "Repository access patterns" }), _jsx("li", { children: "Tool usage statistics" })] })] }), _jsxs("li", { children: [_jsx("strong", { children: "raw-events.json:" }), " Original unprocessed hook events", _jsxs("ul", { style: { marginLeft: '20px', fontSize: '13px', marginTop: '4px' }, children: [_jsx("li", { children: "Preserved for future reprocessing" }), _jsx("li", { children: "Contains complete agent event data" }), _jsx("li", { children: "Optionally excluded to save space" })] })] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.warning,
                                        marginBottom: '8px',
                                    }, children: "Data Retention Policy" }), _jsxs("div", { style: {
                                        padding: '12px',
                                        backgroundColor: `${theme.colors.warning}10`,
                                        borderRadius: '6px',
                                        border: `1px solid ${theme.colors.warning}30`,
                                    }, children: [_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx(HardDrive, { size: 14, style: { display: 'inline', marginRight: '6px' } }), _jsx("strong", { style: { fontSize: '13px', color: theme.colors.text }, children: "Default Retention" })] }), _jsxs("ul", { style: {
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary,
                                                paddingLeft: '20px',
                                                margin: '4px 0',
                                            }, children: [_jsx("li", { children: "Active sessions: Until archived" }), _jsx("li", { children: "Archive files: 30 days" }), _jsx("li", { children: "Session summaries: 7 days" }), _jsx("li", { children: "Total storage limit: 1GB" })] }), _jsx("div", { style: {
                                                marginTop: '8px',
                                                fontSize: '11px',
                                                color: theme.colors.textSecondary,
                                                fontStyle: 'italic',
                                            }, children: "All values configurable in Archive Settings" })] })] }), _jsxs("div", { children: [_jsx("h3", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.info || theme.colors.primary,
                                        marginBottom: '8px',
                                    }, children: "Accessing Archived Data" }), _jsx("p", { style: {
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.5',
                                    }, children: _jsxs("ul", { style: { paddingLeft: '20px' }, children: [_jsxs("li", { children: [_jsx("strong", { children: "Store Viewer:" }), " Click archive count in pipeline view"] }), _jsxs("li", { children: [_jsx("strong", { children: "Export:" }), " Use Archive Settings \u2192 Export options"] }), _jsxs("li", { children: [_jsx("strong", { children: "Direct access:" }), " JSON files in archive directory"] }), _jsxs("li", { children: [_jsx("strong", { children: "API:" }), " Available via IPC handlers for extensions"] })] }) })] })] })] }) }));
};
