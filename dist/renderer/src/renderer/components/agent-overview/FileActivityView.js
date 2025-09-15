import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { Check, Clipboard } from 'lucide-react';
export const FileActivityView = ({ session, FILE_SIZE_THRESHOLDS, }) => {
    const { theme } = useTheme();
    const [fileFilter, setFileFilter] = useState('all');
    const [fileSortBy, setFileSortBy] = useState('size');
    const [fileSearchQuery, setFileSearchQuery] = useState('');
    const [copiedPath, setCopiedPath] = useState(null);
    // Helper function to get relative path from git root
    const getRelativePath = (fullPath) => {
        if (session.basicGitInfo?.gitRoot) {
            const { gitRoot } = session.basicGitInfo;
            if (fullPath.startsWith(gitRoot)) {
                // Remove git root and leading slash
                return fullPath.slice(gitRoot.length).replace(/^\//, '');
            }
        }
        // If no git info or path doesn't start with git root, return the full path
        return fullPath;
    };
    // Calculate file metrics
    const allFiles = [
        ...new Set([
            ...Object.keys(session.fileAccesses || {}),
            ...Object.keys(session.fileWrites || {}),
        ]),
    ];
    const createdFiles = allFiles.filter((file) => {
        const writes = session.fileWrites?.[file] || [];
        return writes.some((w) => w.operation === 'create');
    });
    const deletedFiles = allFiles.filter((file) => {
        const writes = session.fileWrites?.[file] || [];
        return writes.some((w) => w.operation === 'delete');
    });
    const largeFiles = allFiles.filter((file) => {
        const accesses = session.fileAccesses?.[file] || [];
        const writes = session.fileWrites?.[file] || [];
        const lastAccess = accesses[accesses.length - 1];
        const lastWrite = writes[writes.length - 1];
        const lineCount = lastWrite?.metadata?.lineCount || lastAccess?.metadata?.lineCount || 0;
        return lineCount >= FILE_SIZE_THRESHOLDS.WARNING;
    });
    // Apply filters
    const filteredFiles = fileFilter === 'all'
        ? allFiles
        : allFiles.filter((file) => {
            if (fileFilter === 'large') {
                const accesses = session.fileAccesses?.[file] || [];
                const writes = session.fileWrites?.[file] || [];
                const lastAccess = accesses[accesses.length - 1];
                const lastWrite = writes[writes.length - 1];
                const lineCount = lastWrite?.metadata?.lineCount ||
                    lastAccess?.metadata?.lineCount ||
                    0;
                return lineCount >= FILE_SIZE_THRESHOLDS.WARNING;
            }
            const writes = session.fileWrites?.[file] || [];
            if (fileFilter === 'created') {
                return writes.some((w) => w.operation === 'create');
            }
            if (fileFilter === 'updated') {
                return writes.some((w) => w.operation === 'update');
            }
            if (fileFilter === 'deleted') {
                return writes.some((w) => w.operation === 'delete');
            }
            return false;
        });
    // Apply search filter
    const searchedFiles = fileSearchQuery
        ? filteredFiles.filter((file) => file.toLowerCase().includes(fileSearchQuery.toLowerCase()))
        : filteredFiles;
    // Get file info for sorting
    const filesWithInfo = searchedFiles.map((file) => {
        const accesses = session.fileAccesses?.[file] || [];
        const writes = session.fileWrites?.[file] || [];
        const lastAccess = accesses[accesses.length - 1];
        const lastWrite = writes[writes.length - 1];
        const lastActivity = Math.max(lastAccess?.timestamp || 0, lastWrite?.timestamp || 0);
        // Get line count from the most recent access or write
        let lineCount = 0;
        let fileSize = 0;
        // Check writes first (more likely to have updated info)
        if (lastWrite?.metadata?.lineCount) {
            lineCount = lastWrite.metadata.lineCount;
            fileSize = lastWrite.metadata.fileSize || 0;
        }
        else if (lastAccess?.metadata?.lineCount) {
            lineCount = lastAccess.metadata.lineCount;
            fileSize = lastAccess.metadata.fileSize || 0;
        }
        return {
            file,
            accesses,
            writes,
            lastActivity,
            lineCount,
            fileSize,
            totalActivity: accesses.length + writes.length,
        };
    });
    // Sort based on selected criteria
    if (fileSortBy === 'size') {
        filesWithInfo.sort((a, b) => b.lineCount - a.lineCount);
    }
    else if (fileSortBy === 'activity') {
        filesWithInfo.sort((a, b) => b.totalActivity - a.totalActivity);
    }
    else {
        filesWithInfo.sort((a, b) => a.file.localeCompare(b.file));
    }
    function FilePathDisplay({ filePath }) {
        const relativePath = getRelativePath(filePath);
        const fileName = relativePath.split('/').pop() || relativePath;
        const dirPath = relativePath.includes('/')
            ? relativePath.substring(0, relativePath.lastIndexOf('/'))
            : '';
        return (_jsxs("div", { style: { minWidth: 0, flex: 1 }, children: [_jsx("p", { style: {
                        fontFamily: theme.fonts.monospace,
                        fontSize: '14px',
                        fontWeight: 500,
                        color: theme.colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        margin: 0,
                    }, title: fileName, children: fileName }), _jsxs("p", { style: {
                        fontFamily: theme.fonts.monospace,
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        margin: 0,
                        marginTop: '2px',
                    }, title: relativePath, children: [dirPath ? `${dirPath}/` : '', _jsx("span", { style: { opacity: 0.5 }, children: fileName })] })] }));
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    padding: '16px',
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx("h3", { style: { margin: 0, fontWeight: 500, color: theme.colors.text }, children: fileFilter === 'all'
                                            ? 'All Files'
                                            : fileFilter === 'created'
                                                ? 'Created Files'
                                                : fileFilter === 'updated'
                                                    ? 'Updated Files'
                                                    : fileFilter === 'deleted'
                                                        ? 'Deleted Files'
                                                        : 'Large Files' }), fileFilter !== 'all' && (_jsx("button", { onClick: () => setFileFilter('all'), style: {
                                            fontSize: '12px',
                                            color: theme.colors.primary,
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                            transition: 'color 0.2s',
                                        }, onMouseEnter: (e) => (e.currentTarget.style.color = theme.colors.accent), onMouseLeave: (e) => (e.currentTarget.style.color = theme.colors.primary), children: "\u2190 Show all" }))] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '16px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("span", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Filter:" }), _jsxs("select", { value: fileFilter, onChange: (e) => setFileFilter(e.target.value), style: {
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                    backgroundColor: theme.colors.backgroundTertiary,
                                                    color: theme.colors.text,
                                                    borderRadius: '4px',
                                                    border: `1px solid ${theme.colors.border}`,
                                                    cursor: 'pointer',
                                                }, onFocus: (e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.primary}33`), onBlur: (e) => (e.currentTarget.style.boxShadow = 'none'), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "created", children: "Created" }), _jsx("option", { value: "updated", children: "Updated" }), _jsx("option", { value: "deleted", children: "Deleted" }), _jsx("option", { value: "large", children: `Large (${FILE_SIZE_THRESHOLDS.WARNING}+ lines)` })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("span", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Sort:" }), _jsxs("select", { value: fileSortBy, onChange: (e) => setFileSortBy(e.target.value), style: {
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                    backgroundColor: theme.colors.backgroundTertiary,
                                                    color: theme.colors.text,
                                                    borderRadius: '4px',
                                                    border: `1px solid ${theme.colors.border}`,
                                                    cursor: 'pointer',
                                                }, onFocus: (e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.primary}33`), onBlur: (e) => (e.currentTarget.style.boxShadow = 'none'), children: [_jsx("option", { value: "name", children: "Name" }), _jsx("option", { value: "size", children: "Size" }), _jsx("option", { value: "activity", children: "Activity" })] })] })] })] }), _jsx("div", { style: { marginBottom: '12px' }, children: _jsx("input", { type: "text", placeholder: "Search files...", value: fileSearchQuery, onChange: (e) => setFileSearchQuery(e.target.value), style: {
                                width: '100%',
                                padding: '6px 12px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                color: theme.colors.text,
                                fontSize: '14px',
                                borderRadius: '4px',
                                border: `1px solid ${theme.colors.border}`,
                                outline: 'none',
                            }, onFocus: (e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.primary}33`), onBlur: (e) => (e.currentTarget.style.boxShadow = 'none') }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: [filesWithInfo.length === 0 ? (_jsx("div", { style: {
                                    textAlign: 'center',
                                    padding: '16px 0',
                                    color: theme.colors.textSecondary,
                                }, children: _jsx("p", { style: { margin: 0 }, children: "No files match the current filter" }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                            marginBottom: '12px',
                                            fontSize: '12px',
                                            color: theme.colors.textSecondary,
                                        }, children: ["Showing ", filesWithInfo.length, " of ", allFiles.length, " files", fileFilter !== 'all' && (_jsxs("span", { style: {
                                                    marginLeft: '8px',
                                                    padding: '2px 8px',
                                                    backgroundColor: theme.colors.backgroundTertiary,
                                                    borderRadius: '4px',
                                                    color: theme.colors.textSecondary,
                                                }, children: [fileFilter, " filter active"] })), fileSearchQuery && (_jsxs("span", { style: {
                                                    marginLeft: '8px',
                                                    padding: '2px 8px',
                                                    backgroundColor: theme.colors.backgroundTertiary,
                                                    borderRadius: '4px',
                                                    color: theme.colors.textSecondary,
                                                }, children: ["\"", fileSearchQuery, "\" search active"] }))] }), filesWithInfo.map(({ file, accesses, writes, lastActivity, lineCount, fileSize, }) => {
                                        const isLargeFile = lineCount >= FILE_SIZE_THRESHOLDS.LARGE;
                                        const isWarningFile = lineCount >= FILE_SIZE_THRESHOLDS.WARNING &&
                                            lineCount < FILE_SIZE_THRESHOLDS.LARGE;
                                        return (_jsxs("div", { style: {
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                borderRadius: '4px',
                                                padding: '12px',
                                                boxShadow: isLargeFile
                                                    ? `0 0 0 1px ${theme.colors.warning}80`
                                                    : isWarningFile
                                                        ? `0 0 0 1px ${theme.colors.warning}50`
                                                        : 'none',
                                            }, children: [_jsxs("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'space-between',
                                                    }, children: [_jsx(FilePathDisplay, { filePath: file }), _jsxs("div", { style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                            }, children: [_jsx("button", { onClick: () => {
                                                                        const relativePath = getRelativePath(file);
                                                                        navigator.clipboard.writeText(relativePath);
                                                                        setCopiedPath(file);
                                                                        setTimeout(() => setCopiedPath(null), 2000);
                                                                    }, style: {
                                                                        opacity: 0.6,
                                                                        transition: 'opacity 0.2s',
                                                                        fontSize: '12px',
                                                                        padding: '4px',
                                                                        backgroundColor: 'transparent',
                                                                        color: theme.colors.textSecondary,
                                                                        borderRadius: '4px',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                    }, onMouseEnter: (e) => {
                                                                        e.currentTarget.style.opacity = '1';
                                                                        e.currentTarget.style.backgroundColor =
                                                                            theme.colors.backgroundHover;
                                                                    }, onMouseLeave: (e) => {
                                                                        e.currentTarget.style.opacity = '0.6';
                                                                        e.currentTarget.style.backgroundColor =
                                                                            'transparent';
                                                                    }, title: session.basicGitInfo
                                                                        ? 'Copy relative path'
                                                                        : 'Copy filename', children: copiedPath === file ? (_jsx(Check, { size: 14 })) : (_jsx(Clipboard, { size: 14 })) }), lineCount > 0 && (_jsxs("span", { style: {
                                                                        fontSize: '12px',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '999px',
                                                                        flexShrink: 0,
                                                                        backgroundColor: isLargeFile
                                                                            ? `${theme.colors.warning}20`
                                                                            : isWarningFile
                                                                                ? `${theme.colors.warning}20`
                                                                                : theme.colors.backgroundHover,
                                                                        color: isLargeFile
                                                                            ? theme.colors.warning
                                                                            : isWarningFile
                                                                                ? theme.colors.warning
                                                                                : theme.colors.textSecondary,
                                                                    }, children: [lineCount.toLocaleString(), " lines"] }))] })] }), _jsxs("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '16px',
                                                        marginTop: '8px',
                                                        fontSize: '12px',
                                                        color: theme.colors.textSecondary,
                                                    }, children: [accesses.length > 0 && (_jsxs("span", { children: [accesses.length, " read", accesses.length !== 1 ? 's' : ''] })), writes.length > 0 && (_jsxs("span", { children: [writes.length, " write", writes.length !== 1 ? 's' : ''] })), _jsxs("span", { children: ["Last: ", new Date(lastActivity).toLocaleTimeString()] })] })] }, file));
                                    })] })), Object.keys(session.fileAccesses || {}).length === 0 &&
                                Object.keys(session.fileWrites || {}).length === 0 && (_jsx("div", { style: {
                                    textAlign: 'center',
                                    padding: '16px 0',
                                    color: theme.colors.textSecondary,
                                }, children: _jsx("p", { style: { margin: 0 }, children: "No file activity recorded" }) }))] })] }), copiedPath && (_jsx("div", { style: {
                    position: 'fixed',
                    top: '16px',
                    right: '16px',
                    zIndex: 50,
                    animation: 'slideInTop 0.3s ease-out',
                }, children: _jsx("div", { style: {
                        backgroundColor: theme.colors.success,
                        color: theme.colors.background,
                        padding: '8px 16px',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }, children: _jsxs("span", { style: {
                            fontSize: '14px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }, children: [_jsx(Check, { size: 14 }), " Copied to clipboard"] }) }) }))] }));
};
