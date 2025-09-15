import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X, Save, Archive, Clock, HardDrive, Package, Download, Info } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';
export const ArchiveSettingsModal = ({ isOpen, onClose }) => {
    const { theme } = useTheme();
    const [config, setConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [archiveStats, setArchiveStats] = useState(null);
    useEffect(() => {
        if (isOpen) {
            loadConfiguration();
            loadStatistics();
        }
    }, [isOpen]);
    const loadConfiguration = async () => {
        try {
            setIsLoading(true);
            const result = await AgentSessionArchiveService.getConfiguration();
            setConfig(result);
        }
        catch (error) {
            console.error('Failed to load archive configuration:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    const loadStatistics = async () => {
        try {
            const stats = await AgentSessionArchiveService.getStatistics();
            setArchiveStats(stats);
        }
        catch (error) {
            console.error('Failed to load archive statistics:', error);
        }
    };
    const saveConfiguration = async () => {
        if (!config)
            return;
        try {
            setIsSaving(true);
            await AgentSessionArchiveService.updateConfiguration(config);
            onClose();
        }
        catch (error) {
            console.error('Failed to save archive configuration:', error);
        }
        finally {
            setIsSaving(false);
        }
    };
    const archiveAllSessions = async () => {
        try {
            const result = await AgentSessionArchiveService.archiveAllSessions();
            if (result.success) {
                alert(`Archived ${result.archived} sessions`);
                loadStatistics();
            }
            else {
                alert(`Failed to archive sessions: ${result.error}`);
            }
        }
        catch (error) {
            console.error('Failed to archive all sessions:', error);
        }
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background || theme.colors.backgroundPrimary,
                borderRadius: '12px',
                width: '90%',
                maxWidth: '1200px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
            }, children: [_jsxs("div", { style: {
                        padding: '20px 24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }, children: [_jsxs("h2", { style: {
                                fontSize: '22px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }, children: [_jsx(Archive, { size: 26 }), "Archive Settings"] }), _jsx("button", { onClick: onClose, style: {
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
                            }, children: _jsx(X, { size: 20, color: theme.colors.textSecondary }) })] }), archiveStats && (_jsxs("div", { style: {
                        padding: '16px 24px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        gap: '32px',
                        alignItems: 'center',
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("span", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Active Sessions:" }), _jsx("span", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.primary }, children: archiveStats.activeSessionCount })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("span", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Archived:" }), _jsx("span", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.accent }, children: archiveStats.archivedSessionCount })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("span", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Storage Used:" }), _jsxs("span", { style: { fontSize: '15px', fontWeight: 600, color: theme.colors.text }, children: [Math.round(archiveStats.totalStorageUsed / 1024 / 1024), " MB"] })] }), _jsx("div", { style: { marginLeft: 'auto' }, children: _jsxs("button", { onClick: archiveAllSessions, style: {
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: theme.colors.accent,
                                    color: theme.colors.background,
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }, children: [_jsx(Archive, { size: 14 }), "Archive All Now"] }) })] })), _jsx("div", { style: {
                        flex: 1,
                        overflow: 'auto',
                        padding: '24px',
                    }, children: isLoading ? (_jsx("div", { style: {
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '200px',
                            color: theme.colors.textSecondary,
                        }, children: "Loading configuration..." })) : config ? (_jsxs("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '24px',
                        }, children: [_jsxs("div", { style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '8px',
                                    padding: '20px',
                                    border: `1px solid ${theme.colors.border}`,
                                }, children: [_jsxs("h3", { style: {
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }, children: [_jsx(Clock, { size: 20 }), "Auto-Archiving"] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("input", { type: "checkbox", checked: config.autoArchive.enabled, onChange: (e) => setConfig({
                                                            ...config,
                                                            autoArchive: { ...config.autoArchive, enabled: e.target.checked }
                                                        }) }), _jsx("span", { style: { fontSize: '15px', color: theme.colors.text }, children: "Enable auto-archiving" })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Inactivity threshold (hours)" }), _jsx("input", { type: "number", value: config.autoArchive.inactivityThreshold, onChange: (e) => setConfig({
                                                            ...config,
                                                            autoArchive: { ...config.autoArchive, inactivityThreshold: parseInt(e.target.value) || 24 }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        } })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Check interval (minutes)" }), _jsx("input", { type: "number", value: config.autoArchive.checkInterval, onChange: (e) => setConfig({
                                                            ...config,
                                                            autoArchive: { ...config.autoArchive, checkInterval: parseInt(e.target.value) || 60 }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        } })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Completed session delay (seconds)" }), _jsx("input", { type: "number", value: config.autoArchive.completedSessionDelay, onChange: (e) => setConfig({
                                                            ...config,
                                                            autoArchive: { ...config.autoArchive, completedSessionDelay: parseInt(e.target.value) || 5 }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        } })] })] })] }), _jsxs("div", { style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '8px',
                                    padding: '20px',
                                    border: `1px solid ${theme.colors.border}`,
                                }, children: [_jsxs("h3", { style: {
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }, children: [_jsx(HardDrive, { size: 20 }), "Storage Management"] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Max archive age (days)" }), _jsx("input", { type: "number", value: config.storage.maxArchiveAge, onChange: (e) => setConfig({
                                                            ...config,
                                                            storage: { ...config.storage, maxArchiveAge: parseInt(e.target.value) || 30 }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        } })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Max summary age (days)" }), _jsx("input", { type: "number", value: config.storage.maxSummaryAge, onChange: (e) => setConfig({
                                                            ...config,
                                                            storage: { ...config.storage, maxSummaryAge: parseInt(e.target.value) || 7 }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        } })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Max archive size (MB)" }), _jsx("input", { type: "number", value: config.storage.maxArchiveSize, onChange: (e) => setConfig({
                                                            ...config,
                                                            storage: { ...config.storage, maxArchiveSize: parseInt(e.target.value) || 1000 }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        } })] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("input", { type: "checkbox", checked: config.storage.compressArchives, onChange: (e) => setConfig({
                                                            ...config,
                                                            storage: { ...config.storage, compressArchives: e.target.checked }
                                                        }) }), _jsx("span", { style: { fontSize: '15px', color: theme.colors.text }, children: "Compress archives" })] })] })] }), _jsxs("div", { style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '8px',
                                    padding: '20px',
                                    border: `1px solid ${theme.colors.border}`,
                                }, children: [_jsxs("h3", { style: {
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }, children: [_jsx(Package, { size: 20 }), "Session Handling"] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("input", { type: "checkbox", checked: config.sessions.archiveIncompleteSessions, onChange: (e) => setConfig({
                                                            ...config,
                                                            sessions: { ...config.sessions, archiveIncompleteSessions: e.target.checked }
                                                        }) }), _jsx("span", { style: { fontSize: '15px', color: theme.colors.text }, children: "Archive incomplete sessions" })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Min events to archive" }), _jsx("input", { type: "number", value: config.sessions.minEventsToArchive, onChange: (e) => setConfig({
                                                            ...config,
                                                            sessions: { ...config.sessions, minEventsToArchive: parseInt(e.target.value) || 5 }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        } })] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("input", { type: "checkbox", checked: config.sessions.keepRawEvents, onChange: (e) => setConfig({
                                                            ...config,
                                                            sessions: { ...config.sessions, keepRawEvents: e.target.checked }
                                                        }) }), _jsx("span", { style: { fontSize: '15px', color: theme.colors.text }, children: "Include raw events in archives" })] }), _jsx("span", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.textSecondary,
                                                    marginLeft: '26px',
                                                    marginTop: '-8px',
                                                    display: 'block',
                                                    opacity: 0.8
                                                }, children: "Preserves original data for future reprocessing" }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("input", { type: "checkbox", checked: config.sessions.groupByRepository, onChange: (e) => setConfig({
                                                            ...config,
                                                            sessions: { ...config.sessions, groupByRepository: e.target.checked }
                                                        }) }), _jsx("span", { style: { fontSize: '15px', color: theme.colors.text }, children: "Group by repository" })] })] })] }), _jsxs("div", { style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '8px',
                                    padding: '20px',
                                    border: `1px solid ${theme.colors.border}`,
                                }, children: [_jsxs("h3", { style: {
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }, children: [_jsx(Download, { size: 20 }), "Export Settings"] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { children: [_jsx("label", { style: { fontSize: '14px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }, children: "Default format" }), _jsxs("select", { value: config.export.defaultFormat, onChange: (e) => setConfig({
                                                            ...config,
                                                            export: { ...config.export, defaultFormat: e.target.value }
                                                        }), style: {
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            backgroundColor: theme.colors.backgroundPrimary,
                                                            color: theme.colors.text,
                                                        }, children: [_jsx("option", { value: "json", children: "JSON" }), _jsx("option", { value: "csv", children: "CSV" }), _jsx("option", { value: "markdown", children: "Markdown" })] })] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("input", { type: "checkbox", checked: config.export.includeRawEvents, onChange: (e) => setConfig({
                                                            ...config,
                                                            export: { ...config.export, includeRawEvents: e.target.checked }
                                                        }) }), _jsx("span", { style: { fontSize: '15px', color: theme.colors.text }, children: "Include raw events" })] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("input", { type: "checkbox", checked: config.export.includeMetrics, onChange: (e) => setConfig({
                                                            ...config,
                                                            export: { ...config.export, includeMetrics: e.target.checked }
                                                        }) }), _jsx("span", { style: { fontSize: '15px', color: theme.colors.text }, children: "Include metrics" })] })] })] })] })) : (_jsx("div", { style: {
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '200px',
                            color: theme.colors.textSecondary,
                        }, children: "Failed to load configuration" })) }), _jsxs("div", { style: {
                        padding: '16px 24px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }, children: [_jsxs("div", { style: {
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }, children: [_jsx(Info, { size: 16 }), "Changes will take effect immediately"] }), _jsxs("div", { style: { display: 'flex', gap: '12px' }, children: [_jsx("button", { onClick: onClose, style: {
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: `1px solid ${theme.colors.border}`,
                                        backgroundColor: 'transparent',
                                        color: theme.colors.text,
                                        fontSize: '15px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }, children: "Cancel" }), _jsxs("button", { onClick: saveConfiguration, disabled: isSaving, style: {
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        backgroundColor: theme.colors.primary,
                                        color: theme.colors.background,
                                        fontSize: '15px',
                                        fontWeight: 500,
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        opacity: isSaving ? 0.7 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }, children: [_jsx(Save, { size: 16 }), isSaving ? 'Saving...' : 'Save Changes'] })] })] })] }) }));
};
