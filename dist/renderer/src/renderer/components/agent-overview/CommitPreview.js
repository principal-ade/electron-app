import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { GitCommit, FilePlus, FileX, FileEdit, ArrowRight, } from 'lucide-react';
export const CommitPreview = ({ sessionId, directory, onCommit, }) => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [uncommittedChanges, setUncommittedChanges] = useState(null);
    const [commitMessage, setCommitMessage] = useState('');
    const [committing, setCommitting] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    useEffect(() => {
        loadUncommittedChanges();
    }, [sessionId]);
    const loadUncommittedChanges = async () => {
        setLoading(true);
        try {
            const result = await window.electron?.agentSession?.getUncommittedChangesForSegments(sessionId);
            if (result) {
                setUncommittedChanges(result);
                // Generate default commit message
                if (result.changes) {
                    const parts = [];
                    if (result.changes.created.length > 0) {
                        parts.push(`Added ${result.changes.created.length} file${result.changes.created.length > 1 ? 's' : ''}`);
                    }
                    if (result.changes.modified.length > 0) {
                        parts.push(`Modified ${result.changes.modified.length} file${result.changes.modified.length > 1 ? 's' : ''}`);
                    }
                    if (result.changes.deleted.length > 0) {
                        parts.push(`Deleted ${result.changes.deleted.length} file${result.changes.deleted.length > 1 ? 's' : ''}`);
                    }
                    setCommitMessage(parts.join(', ') || 'Update files');
                }
            }
        }
        catch (error) {
            console.error('Failed to load uncommitted changes:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleCommit = async () => {
        if (!commitMessage.trim() || !uncommittedChanges)
            return;
        setCommitting(true);
        try {
            const result = await window.electron?.agentSession?.performManualCommit(sessionId, commitMessage);
            if (result?.success) {
                // Reload changes
                await loadUncommittedChanges();
                setCommitMessage('');
                onCommit?.();
            }
            else {
                console.error('Commit failed:', result?.error);
            }
        }
        catch (error) {
            console.error('Failed to commit:', error);
        }
        finally {
            setCommitting(false);
        }
    };
    if (loading) {
        return (_jsx("div", { style: {
                padding: '16px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                margin: '16px',
            }, children: _jsx("div", { style: { color: theme.colors.textSecondary, textAlign: 'center' }, children: "Loading changes..." }) }));
    }
    if (!uncommittedChanges ||
        !uncommittedChanges.changes ||
        (uncommittedChanges.changes.created.length === 0 &&
            uncommittedChanges.changes.modified.length === 0 &&
            uncommittedChanges.changes.deleted.length === 0)) {
        return null;
    }
    const { changes, segments } = uncommittedChanges;
    const totalChanges = changes.created.length +
        changes.modified.length +
        changes.deleted.length +
        changes.renamed.length;
    return (_jsxs("div", { style: {
            margin: '16px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            overflow: 'hidden',
        }, children: [_jsxs("div", { style: {
                    padding: '16px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(GitCommit, { size: 20, color: theme.colors.primary }), _jsx("h3", { style: {
                                    margin: 0,
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                }, children: "Uncommitted Changes" }), _jsxs("span", { style: {
                                    fontSize: '12px',
                                    padding: '2px 8px',
                                    backgroundColor: `${theme.colors.primary}20`,
                                    color: theme.colors.primary,
                                    borderRadius: '12px',
                                }, children: [segments.length, " segment", segments.length > 1 ? 's' : ''] })] }), _jsxs("button", { onClick: () => setShowDetails(!showDetails), style: {
                            background: 'none',
                            border: 'none',
                            color: theme.colors.primary,
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s',
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }, children: [showDetails ? 'Hide' : 'Show', " Details"] })] }), _jsxs("div", { style: {
                    padding: '16px',
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                }, children: [changes.created.length > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [_jsx(FilePlus, { size: 16, color: theme.colors.success }), _jsxs("span", { style: { fontSize: '14px', color: theme.colors.text }, children: [changes.created.length, " created"] })] })), changes.modified.length > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [_jsx(FileEdit, { size: 16, color: theme.colors.warning }), _jsxs("span", { style: { fontSize: '14px', color: theme.colors.text }, children: [changes.modified.length, " modified"] })] })), changes.deleted.length > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [_jsx(FileX, { size: 16, color: theme.colors.danger }), _jsxs("span", { style: { fontSize: '14px', color: theme.colors.text }, children: [changes.deleted.length, " deleted"] })] })), changes.renamed.length > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [_jsx(ArrowRight, { size: 16, color: theme.colors.info }), _jsxs("span", { style: { fontSize: '14px', color: theme.colors.text }, children: [changes.renamed.length, " renamed"] })] })), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: '8px' }, children: [_jsxs("span", { style: { fontSize: '14px', color: theme.colors.success }, children: ["+", changes.stats.additions] }), _jsxs("span", { style: { fontSize: '14px', color: theme.colors.danger }, children: ["-", changes.stats.deletions] })] })] }), showDetails && (_jsxs("div", { style: {
                    padding: '0 16px 16px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                }, children: [changes.created.length > 0 && (_jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    marginBottom: '4px',
                                }, children: "Created Files" }), changes.created.map((file, i) => (_jsxs("div", { style: {
                                    fontSize: '13px',
                                    color: theme.colors.success,
                                    marginLeft: '16px',
                                }, children: ["+ ", file] }, i)))] })), changes.modified.length > 0 && (_jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    marginBottom: '4px',
                                }, children: "Modified Files" }), changes.modified.map((file, i) => (_jsxs("div", { style: {
                                    fontSize: '13px',
                                    color: theme.colors.warning,
                                    marginLeft: '16px',
                                }, children: ["~ ", file] }, i)))] })), changes.deleted.length > 0 && (_jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    marginBottom: '4px',
                                }, children: "Deleted Files" }), changes.deleted.map((file, i) => (_jsxs("div", { style: {
                                    fontSize: '13px',
                                    color: theme.colors.danger,
                                    marginLeft: '16px',
                                }, children: ["- ", file] }, i)))] })), changes.renamed.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    marginBottom: '4px',
                                }, children: "Renamed Files" }), changes.renamed.map((rename, i) => (_jsxs("div", { style: {
                                    fontSize: '13px',
                                    color: theme.colors.info,
                                    marginLeft: '16px',
                                }, children: [rename.from, " \u2192 ", rename.to] }, i)))] }))] })), _jsx("div", { style: {
                    padding: '16px',
                    borderTop: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                }, children: _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx("input", { type: "text", value: commitMessage, onChange: (e) => setCommitMessage(e.target.value), placeholder: "Commit message...", style: {
                                flex: 1,
                                padding: '8px 12px',
                                fontSize: '14px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                outline: 'none',
                            }, onFocus: (e) => {
                                e.currentTarget.style.borderColor = theme.colors.primary;
                            }, onBlur: (e) => {
                                e.currentTarget.style.borderColor = theme.colors.border;
                            } }), _jsx("button", { onClick: handleCommit, disabled: !commitMessage.trim() || committing, style: {
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                backgroundColor: theme.colors.primary,
                                color: theme.colors.background,
                                border: 'none',
                                borderRadius: '4px',
                                cursor: commitMessage.trim() && !committing ? 'pointer' : 'not-allowed',
                                opacity: commitMessage.trim() && !committing ? 1 : 0.5,
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                if (commitMessage.trim() && !committing) {
                                    e.currentTarget.style.opacity = '0.8';
                                }
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.opacity =
                                    commitMessage.trim() && !committing ? '1' : '0.5';
                            }, children: committing ? 'Committing...' : 'Commit' })] }) })] }));
};
