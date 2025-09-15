import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { AnimatedResizableLayout } from "@a24z/panels";
import "@a24z/panels/style.css";
import { FileText, X, Clipboard, Check } from 'lucide-react';
import { AnimatedTimelineEvent } from '../landing-page/AnimatedTimelineEvent';
import { FileViewer } from '../FileViewer';
export const ActiveSegmentTimeline = ({ activeSegment, session, newEventIds, }) => {
    const { theme } = useTheme();
    const [viewingFile, setViewingFile] = useState(null);
    const [copiedPath, setCopiedPath] = useState(null);
    const [expandedEdits, setExpandedEdits] = useState(new Set());
    const [grepResults, setGrepResults] = useState({});
    const [bashResults, setBashResults] = useState({});
    // Debug flag for showing path normalization info
    const DEBUG_SHOW_PATH_INFO = false;
    // Helper function to get relative path from git root
    const getRelativePath = (fullPath) => {
        if (session?.basicGitInfo?.gitRoot) {
            const { gitRoot } = session.basicGitInfo;
            if (fullPath.startsWith(gitRoot)) {
                // Remove git root and leading slash
                return fullPath.slice(gitRoot.length).replace(/^\//, '');
            }
        }
        // Fallback to just the filename if no git info
        return fullPath.split('/').pop() || fullPath;
    };
    // Enhanced file path processing using available session data
    const processFilePath = (filePath) => {
        if (!filePath)
            return { fileName: '', dirPath: '', packageInfo: null };
        const fileName = filePath.split('/').pop() || filePath;
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '';
        // Step 1: Build a simple file tree from session data
        let allFilePaths = [];
        // Get all file paths from file accesses and writes
        allFilePaths = [
            ...Object.keys(session.fileAccesses || {}),
            ...Object.keys(session.fileWrites || {}),
        ];
        // Step 2: Try to find the complete path by searching session files
        let resolvedPath = null;
        // Look for exact matches or endings
        const exactMatch = allFilePaths.find((path) => path === filePath);
        if (exactMatch) {
            resolvedPath = exactMatch;
        }
        else {
            // Look for paths that end with our file path
            const endingMatch = allFilePaths.find((path) => path.endsWith(`/${filePath}`) || path.endsWith(filePath));
            if (endingMatch) {
                resolvedPath = endingMatch;
            }
        }
        // Step 3: Use resolved or original path for workspace matching
        const searchPath = resolvedPath || filePath;
        if (session?.workspaceBoundaries) {
            // Find the most specific workspace (longest rootPath match)
            let bestMatch = null;
            let longestMatch = 0;
            for (const workspace of session.workspaceBoundaries) {
                const { rootPath } = workspace;
                // Handle different root path patterns
                let isMatch = false;
                if (rootPath === '.' || rootPath === '') {
                    // Root workspace - check if it's not in any sub-workspace
                    isMatch = !session.workspaceBoundaries.some((ws) => ws !== workspace &&
                        ws.rootPath !== '.' &&
                        ws.rootPath !== '' &&
                        searchPath.startsWith(`${ws.rootPath}/`));
                }
                else if (rootPath.startsWith('../')) {
                    // Parent directory workspace - extract the actual package name
                    const packageName = rootPath.split('/').pop();
                    isMatch =
                        searchPath.includes(`${packageName}/`) ||
                            searchPath.includes(`/${packageName}/`);
                }
                else {
                    // Direct path match
                    isMatch =
                        searchPath.startsWith(`${rootPath}/`) || searchPath === rootPath;
                }
                if (isMatch && rootPath.length > longestMatch) {
                    longestMatch = rootPath.length;
                    bestMatch = workspace;
                }
            }
            if (bestMatch) {
                // Calculate relative path from workspace root
                let relativePath = searchPath;
                // For the principle-md-electron package (rootPath is '.'), extract relative path properly
                if (bestMatch.name === 'principle-md-electron' ||
                    bestMatch.rootPath === '.' ||
                    bestMatch.rootPath === '') {
                    // This is the electron-react package
                    // Find the part after 'electron-react' in the path
                    const electronReactIndex = searchPath.indexOf('electron-react/');
                    if (electronReactIndex >= 0) {
                        relativePath = searchPath.substring(electronReactIndex + 'electron-react/'.length);
                    }
                    else {
                        // If no 'electron-react' found, use the original path (it's already relative)
                        relativePath = searchPath;
                    }
                }
                else if (bestMatch.rootPath.startsWith('../')) {
                    // For parent workspaces, extract relative to package
                    const packageName = bestMatch.rootPath.split('/').pop();
                    const packageIndex = searchPath.indexOf(`${packageName}/`);
                    if (packageIndex >= 0) {
                        relativePath = searchPath.substring(packageIndex + packageName.length + 1);
                    }
                }
                else {
                    // Direct path match
                    relativePath = searchPath.substring(bestMatch.rootPath.length + 1);
                }
                const relDirPath = relativePath.substring(0, relativePath.lastIndexOf('/')) || '';
                const packageInfo = {
                    name: bestMatch.name,
                    type: 'npm',
                    color: { background: `${theme.colors.surface}33`, color: theme.colors.textSecondary },
                };
                return { fileName, dirPath: relDirPath, packageInfo };
            }
        }
        // Fallback: Try legacy repository matching
        if (session?.repositories) {
            let bestMatch = null;
            let longestMatch = 0;
            for (const repo of session.repositories) {
                for (const pkg of repo.packages) {
                    const pkgPath = pkg.path.replace(/\/$/, '');
                    const normalizedSearchPath = searchPath.startsWith('/')
                        ? searchPath
                        : `/${searchPath}`;
                    const normalizedPkgPath = pkgPath.startsWith('/')
                        ? pkgPath
                        : `/${pkgPath}`;
                    if (normalizedSearchPath.startsWith(`${normalizedPkgPath}/`)) {
                        if (normalizedPkgPath.length > longestMatch) {
                            longestMatch = normalizedPkgPath.length;
                            bestMatch = {
                                pkg,
                                relativePath: normalizedSearchPath.substring(normalizedPkgPath.length + 1),
                            };
                        }
                    }
                }
            }
            if (bestMatch) {
                const packageInfo = {
                    name: bestMatch.pkg.name,
                    type: bestMatch.pkg.type,
                    color: bestMatch.pkg.type === 'npm'
                        ? { background: `${theme.colors.success}33`, color: theme.colors.success }
                        : bestMatch.pkg.type === 'yarn'
                            ? { background: `${theme.colors.primary}33`, color: theme.colors.primary }
                            : bestMatch.pkg.type === 'pnpm'
                                ? { background: `${theme.colors.warning}33`, color: theme.colors.warning }
                                : { background: `${theme.colors.surface}33`, color: theme.colors.textSecondary },
                };
                const relDirPath = bestMatch.relativePath.substring(0, bestMatch.relativePath.lastIndexOf('/')) || '';
                return { fileName, dirPath: relDirPath, packageInfo };
            }
        }
        // Final fallback to regular normalization
        return {
            fileName,
            dirPath,
            packageInfo: null,
        };
    };
    // Component to display file path with package badge
    function FilePathDisplay({ filePath, originalPath, normalizedPath, onOpenFile, className = '', showDebug = false, showPackageInline = false, }) {
        const { fileName, dirPath, packageInfo } = processFilePath(filePath);
        // For debugging, show both paths if they differ (only when debug flag is enabled)
        const showDebugInfo = showDebug &&
            DEBUG_SHOW_PATH_INFO &&
            originalPath &&
            normalizedPath &&
            originalPath !== normalizedPath;
        if (showPackageInline && packageInfo) {
            // Inline package display
            return (_jsxs("div", { className: `min-w-0 ${className}`, children: [_jsxs("span", { className: "font-mono text-base text-white truncate block", title: `${fileName} (from: ${filePath})`, children: [_jsx("span", { className: "text-base px-2 py-0.5 mr-2", style: {
                                    backgroundColor: packageInfo.color.background,
                                    color: packageInfo.color.color,
                                }, children: packageInfo.name }), fileName] }), dirPath && (_jsx("span", { className: "font-mono text-sm truncate block mt-1", style: { color: theme.colors.textSecondary }, title: dirPath, children: dirPath })), showDebugInfo && (_jsxs("div", { className: "mt-1 text-xs font-mono", children: [_jsxs("div", { style: { color: theme.colors.textMuted }, children: ["Original: ", originalPath || filePath] }), _jsxs("div", { style: { color: theme.colors.textMuted }, children: ["Normalized: ", normalizedPath || filePath] })] }))] }));
        }
        return (_jsx("div", { className: `min-w-0 ${className}`, children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "font-mono text-base text-white truncate block", title: `${fileName} (from: ${filePath})`, children: fileName }), dirPath && (_jsx("span", { className: "font-mono text-sm truncate block mt-1", style: { color: theme.colors.textSecondary }, title: dirPath, children: dirPath })), showDebugInfo && (_jsxs("div", { className: "mt-1 text-xs font-mono", children: [_jsxs("div", { style: { color: theme.colors.textMuted }, children: ["Original: ", originalPath || filePath] }), _jsxs("div", { style: { color: theme.colors.textMuted }, children: ["Normalized: ", normalizedPath || filePath] })] }))] }), _jsxs("div", { className: "flex items-center gap-1", children: [onOpenFile && (_jsx("button", { onClick: (e) => {
                                    e.stopPropagation();
                                    onOpenFile();
                                }, className: "opacity-60 hover:opacity-100 transition-opacity p-1 rounded", style: {
                                    transition: 'all 0.2s',
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.surface;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }, title: "Open file", children: _jsx(FileText, { size: 14, style: { color: theme.colors.textSecondary } }) })), _jsx("button", { onClick: (e) => {
                                    e.stopPropagation();
                                    const relativePath = getRelativePath(filePath);
                                    navigator.clipboard.writeText(relativePath);
                                    setCopiedPath(filePath);
                                    setTimeout(() => setCopiedPath(null), 2000);
                                }, className: "opacity-60 hover:opacity-100 transition-opacity p-1 rounded", style: {
                                    transition: 'all 0.2s',
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.surface;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }, title: session?.basicGitInfo ? 'Copy relative path' : 'Copy filename', children: copiedPath === filePath ? (_jsx(Check, { size: 14, style: { color: theme.colors.success } })) : (_jsx(Clipboard, { size: 14, style: { color: theme.colors.textSecondary } })) })] })] }) }));
    }
    // Helper function to handle file opening
    const handleOpenFile = (event) => {
        let filePath = null;
        if (event.type === 'grouped') {
            // For grouped events, prefer the original path from one of the events
            const firstEvent = event.data.events[0];
            filePath =
                firstEvent.data.originalPath ||
                    firstEvent.data.file ||
                    firstEvent.data.parameters?.file_path ||
                    event.data.filePath;
        }
        else if (event.type === 'file-read' || event.type === 'file-write') {
            // Prefer original path over normalized
            filePath = event.data.originalPath || event.data.file;
        }
        else if (event.type === 'tool' &&
            (event.data.toolName === 'Edit' ||
                event.data.toolName === 'Write' ||
                event.data.toolName === 'Read' ||
                event.data.toolName === 'MultiEdit') &&
            event.data.parameters?.file_path) {
            // Prefer original path over normalized
            filePath = event.data.originalPath || event.data.parameters?.file_path;
        }
        if (filePath) {
            // Convert relative path to absolute if needed
            if (!filePath.startsWith('/') && session.basicGitInfo?.gitRoot) {
                // If it's a relative path and we have git root, make it absolute
                filePath = `${session.basicGitInfo.gitRoot}/${filePath}`;
            }
            else if (!filePath.startsWith('/') && session.workingDirectory) {
                // Fallback to working directory
                filePath = `${session.workingDirectory}/${filePath}`;
            }
            setViewingFile(filePath);
        }
    };
    const renderEventContent = (event, timeStr) => {
        if (event.type === 'grouped') {
            // Render grouped events
            const { events, filePath } = event.data;
            const hasRead = events.some((e) => e.type === 'file-read');
            const hasWrite = events.some((e) => e.type === 'file-write');
            const editEvent = events.find((e) => e.type === 'tool' && e.data.toolName === 'Edit');
            // Build operation string
            let operationText = 'File ';
            if (hasWrite) {
                operationText += 'Write';
            }
            else if (hasRead) {
                operationText += 'Read';
            }
            const { packageInfo } = processFilePath(filePath);
            const expandKey = `${event.data.events[0].timestamp}-grouped`;
            return (_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "font-medium text-blue-400", children: [operationText, packageInfo && (_jsx("span", { className: "text-base px-2 py-0.5 ml-2", style: {
                                            backgroundColor: packageInfo.color.background,
                                            color: packageInfo.color.color,
                                        }, children: packageInfo.name }))] }), _jsxs("span", { className: "text-xs px-1.5 py-0.5 rounded", style: { backgroundColor: theme.colors.surface, color: theme.colors.textSecondary }, children: [events.length, " operations"] })] }), _jsx("span", { className: "absolute top-0 right-0 text-xs", style: { color: theme.colors.textMuted }, children: timeStr }), _jsx(FilePathDisplay, { filePath: filePath, originalPath: event.data.events[0].data.originalPath ||
                            event.data.events[0].data.parameters?.file_path ||
                            event.data.events[0].data.file, normalizedPath: event.data.events[0].data.normalizedPath, onOpenFile: () => handleOpenFile(event), className: "mt-1", showDebug: true, showPackageInline: false }), editEvent && editEvent.data.parameters.old_string && (_jsx("div", { className: "mt-2", children: expandedEdits.has(expandKey) ? (_jsxs("div", { className: "space-y-2", children: [_jsx("button", { onClick: () => {
                                        const newExpanded = new Set(expandedEdits);
                                        newExpanded.delete(expandKey);
                                        setExpandedEdits(newExpanded);
                                    }, className: "text-xs text-blue-400 hover:text-blue-300", children: "\u2191 Collapse edit" }), _jsxs("div", { className: "rounded p-2 text-xs font-mono", style: { backgroundColor: theme.colors.background }, children: [_jsx("div", { className: "text-red-400 line-through whitespace-pre-wrap", children: editEvent.data.parameters.old_string }), _jsx("div", { className: "my-2", style: { color: theme.colors.textMuted }, children: "\u2192" }), _jsx("div", { className: "text-green-400 whitespace-pre-wrap", children: editEvent.data.parameters.new_string })] })] })) : (_jsx("button", { onClick: () => {
                                setExpandedEdits(new Set([...expandedEdits, expandKey]));
                            }, className: "text-xs text-blue-400 hover:text-blue-300", children: "\u2193 Show edit diff" })) }))] }));
        }
        if (event.type === 'tool') {
            // Get package info if this is a file-related tool
            let packageInfo = null;
            if ((event.data.toolName === 'Edit' ||
                event.data.toolName === 'Write' ||
                event.data.toolName === 'Read' ||
                event.data.toolName === 'MultiEdit') &&
                event.data.parameters?.file_path) {
                const pathInfo = processFilePath(event.data.parameters.file_path);
                packageInfo = pathInfo.packageInfo;
            }
            return (_jsxs("div", { className: "relative", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsxs("span", { className: "font-medium text-white", children: [event.data.toolName, packageInfo && (_jsx("span", { className: "text-base px-2 py-0.5 ml-2", style: {
                                        backgroundColor: packageInfo.color.background,
                                        color: packageInfo.color.color,
                                    }, children: packageInfo.name }))] }) }), _jsx("span", { className: "absolute top-0 right-0 text-xs", style: { color: theme.colors.textMuted }, children: timeStr }), event.data.parameters && (_jsxs(_Fragment, { children: [(event.data.toolName === 'Edit' ||
                                event.data.toolName === 'Write' ||
                                event.data.toolName === 'Read' ||
                                event.data.toolName === 'MultiEdit') &&
                                event.data.parameters?.file_path && (_jsx(FilePathDisplay, { filePath: event.data.parameters.file_path, originalPath: event.data.originalPath || event.data.parameters.file_path, normalizedPath: event.data.normalizedPath, onOpenFile: () => handleOpenFile(event), className: "mt-1", showDebug: true, showPackageInline: false })), event.data.toolName === 'Edit' &&
                                event.data.parameters?.old_string && (_jsx("div", { className: "mt-2", children: expandedEdits.has(`${event.data.timestamp}-${event.data.toolName}`) ? (_jsxs("div", { className: "space-y-2", children: [_jsx("button", { onClick: () => {
                                                const key = `${event.data.timestamp}-${event.data.toolName}`;
                                                const newExpanded = new Set(expandedEdits);
                                                newExpanded.delete(key);
                                                setExpandedEdits(newExpanded);
                                            }, className: "text-xs text-blue-400 hover:text-blue-300", children: "\u2191 Collapse edit" }), _jsxs("div", { className: "rounded p-2 text-xs font-mono", style: { backgroundColor: theme.colors.background }, children: [_jsx("div", { className: "text-red-400 line-through whitespace-pre-wrap", children: event.data.parameters?.old_string }), _jsx("div", { className: "text-green-400 mt-2 whitespace-pre-wrap", children: event.data.parameters?.new_string })] })] })) : (_jsxs("button", { onClick: () => {
                                        const key = `${event.data.timestamp}-${event.data.toolName}`;
                                        const newExpanded = new Set(expandedEdits);
                                        newExpanded.add(key);
                                        setExpandedEdits(newExpanded);
                                    }, className: "text-xs", style: {
                                        color: theme.colors.textMuted,
                                        transition: 'color 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.color = theme.colors.textSecondary;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.color = theme.colors.textMuted;
                                    }, children: ["\u2193 Show edit (", event.data.parameters?.old_string?.split('\n')
                                            .length || 0, ' ', "lines changed)"] })) })), event.data.toolName === 'Grep' && (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsxs("p", { className: "text-sm", style: { color: theme.colors.textSecondary }, children: ["Searched for \"", event.data.parameters?.pattern || 'pattern', "\"", event.data.parameters?.glob &&
                                                ` in ${event.data.parameters.glob} files`, event.data.parameters?.path &&
                                                ` within ${processFilePath(event.data.parameters.path).dirPath || event.data.parameters.path}`, event.data.parameters?.output_mode &&
                                                event.data.parameters.output_mode !==
                                                    'files_with_matches' &&
                                                ` (${event.data.parameters.output_mode} mode)`] }), _jsx("button", { onClick: async () => {
                                            const key = `grep-${event.data.timestamp}`;
                                            setGrepResults((prev) => ({
                                                ...prev,
                                                [key]: { loading: true, data: null },
                                            }));
                                            try {
                                                const result = await window.shellAPI.runGrep(event.data.parameters);
                                                setGrepResults((prev) => ({
                                                    ...prev,
                                                    [key]: { loading: false, data: result },
                                                }));
                                            }
                                            catch (error) {
                                                console.error('Grep failed:', error);
                                                setGrepResults((prev) => ({
                                                    ...prev,
                                                    [key]: {
                                                        loading: false,
                                                        data: { error: error.message },
                                                    },
                                                }));
                                            }
                                        }, className: "text-xs px-2 py-1 text-white rounded", style: {
                                            backgroundColor: theme.colors.background,
                                            transition: 'background-color 0.2s',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.surface;
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.background;
                                        }, children: "Re-run" }), grepResults[`grep-${event.data.timestamp}`] && (_jsx("div", { className: "mt-2 rounded p-2", style: { backgroundColor: theme.colors.background }, children: grepResults[`grep-${event.data.timestamp}`].loading ? (_jsx("p", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: "Running grep..." })) : grepResults[`grep-${event.data.timestamp}`].data
                                            ?.error ? (_jsxs("p", { className: "text-xs", style: { color: theme.colors.error }, children: ["Error:", ' ', grepResults[`grep-${event.data.timestamp}`].data
                                                    .error] })) : grepResults[`grep-${event.data.timestamp}`].data
                                            ?.matches ? (_jsxs("div", { className: "space-y-1", children: [_jsxs("p", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: ["Found", ' ', grepResults[`grep-${event.data.timestamp}`].data
                                                            .matches.length, ' ', "matches:"] }), _jsxs("div", { className: "max-h-40 overflow-y-auto", children: [grepResults[`grep-${event.data.timestamp}`].data.matches
                                                            .slice(0, 20)
                                                            .map((match, idx) => (_jsx("div", { className: "text-xs font-mono", style: { color: theme.colors.textTertiary }, children: match }, idx))), grepResults[`grep-${event.data.timestamp}`].data
                                                            .matches.length > 20 && (_jsxs("p", { className: "text-xs mt-1", style: { color: theme.colors.textMuted }, children: ["... and", ' ', grepResults[`grep-${event.data.timestamp}`]
                                                                    .data.matches.length - 20, ' ', "more"] }))] })] })) : (_jsx("p", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: "No results" })) }))] })), event.data.toolName === 'Bash' && (_jsxs("div", { className: "mt-2 space-y-2", children: [event.data.parameters?.description && (_jsx("p", { className: "text-sm font-medium text-white", children: event.data.parameters.description })), _jsx("div", { className: "rounded p-2", style: { backgroundColor: theme.colors.background }, children: _jsx("code", { className: "text-xs font-mono block whitespace-pre-wrap", style: { color: theme.colors.textTertiary }, children: event.data.parameters?.command }) }), _jsx("button", { onClick: async () => {
                                            const key = `bash-${event.data.timestamp}`;
                                            setBashResults((prev) => ({
                                                ...prev,
                                                [key]: { loading: true, data: null },
                                            }));
                                            try {
                                                const result = await window.shellAPI.runBashCommand({
                                                    command: event.data.parameters?.command,
                                                    cwd: event.data.parameters?.cwd,
                                                });
                                                setBashResults((prev) => ({
                                                    ...prev,
                                                    [key]: { loading: false, data: result },
                                                }));
                                            }
                                            catch (error) {
                                                console.error('Bash command failed:', error);
                                                setBashResults((prev) => ({
                                                    ...prev,
                                                    [key]: {
                                                        loading: false,
                                                        data: { error: error.message },
                                                    },
                                                }));
                                            }
                                        }, className: "text-xs px-2 py-1 text-white rounded", style: {
                                            backgroundColor: theme.colors.background,
                                            transition: 'background-color 0.2s',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.surface;
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.background;
                                        }, children: "Re-run" }), bashResults[`bash-${event.data.timestamp}`] && (_jsx("div", { className: "mt-2 rounded p-2", style: { backgroundColor: theme.colors.background }, children: bashResults[`bash-${event.data.timestamp}`].loading ? (_jsx("p", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: "Running command..." })) : bashResults[`bash-${event.data.timestamp}`].data
                                            ?.error ? (_jsxs("p", { className: "text-xs", style: { color: theme.colors.error }, children: ["Error:", ' ', bashResults[`bash-${event.data.timestamp}`].data
                                                    .error] })) : (_jsxs("div", { className: "space-y-1", children: [bashResults[`bash-${event.data.timestamp}`].data
                                                    ?.stdout && (_jsxs("div", { className: "max-h-40 overflow-y-auto", children: [_jsx("p", { className: "text-xs mb-1", style: { color: theme.colors.textMuted }, children: "Output:" }), _jsx("pre", { className: "text-xs font-mono whitespace-pre-wrap", style: { color: theme.colors.success }, children: bashResults[`bash-${event.data.timestamp}`]
                                                                .data.stdout })] })), bashResults[`bash-${event.data.timestamp}`].data
                                                    ?.stderr && (_jsxs("div", { className: "mt-2", children: [_jsx("p", { className: "text-xs mb-1", style: { color: theme.colors.textMuted }, children: "Errors:" }), _jsx("pre", { className: "text-xs font-mono whitespace-pre-wrap", style: { color: theme.colors.error }, children: bashResults[`bash-${event.data.timestamp}`]
                                                                .data.stderr })] }))] })) }))] }))] }))] }));
        }
        if (event.type === 'file-read') {
            const { fileName, packageInfo } = processFilePath(event.data.file);
            return (_jsxs("div", { className: "relative", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsxs("span", { className: "font-medium text-white", children: ["File ", event.data.write?.operation || 'Read', packageInfo && (_jsx("span", { className: "text-base px-2 py-0.5 ml-2", style: {
                                        backgroundColor: packageInfo.color.background,
                                        color: packageInfo.color.color,
                                    }, children: packageInfo.name }))] }) }), _jsx("span", { className: "absolute top-0 right-0 text-xs", style: { color: theme.colors.textMuted }, children: timeStr }), _jsx(FilePathDisplay, { filePath: event.data.file, originalPath: event.data.originalPath || event.data.file, normalizedPath: event.data.normalizedPath, onOpenFile: () => handleOpenFile(event), className: "mt-1", showDebug: true, showPackageInline: false })] }));
        }
        if (event.type === 'file-write') {
            const { packageInfo } = processFilePath(event.data.file);
            const operation = event.data.write?.operation || 'update';
            return (_jsxs("div", { className: "relative", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsxs("span", { className: `font-medium ${operation === 'create'
                                ? 'text-green-400'
                                : operation === 'delete'
                                    ? 'text-red-400'
                                    : 'text-yellow-400'}`, children: ["File", ' ', operation === 'create'
                                    ? 'Create'
                                    : operation === 'delete'
                                        ? 'Delete'
                                        : 'Update', packageInfo && (_jsx("span", { className: "text-base px-2 py-0.5 ml-2", style: {
                                        backgroundColor: packageInfo.color.background,
                                        color: packageInfo.color.color,
                                    }, children: packageInfo.name }))] }) }), _jsx("span", { className: "absolute top-0 right-0 text-xs", style: { color: theme.colors.textMuted }, children: timeStr }), _jsx(FilePathDisplay, { filePath: event.data.file, originalPath: event.data.originalPath || event.data.file, normalizedPath: event.data.normalizedPath, onOpenFile: () => handleOpenFile(event), className: "mt-1", showDebug: true, showPackageInline: false })] }));
        }
        if (event.type === 'web') {
            return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium text-white", children: "Web Access" }), _jsx("span", { className: "text-xs", style: { color: theme.colors.textMuted }, children: timeStr })] }), _jsx("p", { className: "text-sm mt-1 truncate", style: { color: theme.colors.textSecondary }, title: event.data.url, children: event.data.url }), event.data.prompt && (_jsx("p", { className: "text-xs mt-1 line-clamp-2", style: { color: theme.colors.textMuted }, children: event.data.prompt }))] }));
        }
        if (event.type === 'stop') {
            return (_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium text-red-400", children: "Session Stop" }), _jsx("span", { className: "text-xs", style: { color: theme.colors.textMuted }, children: timeStr })] }), event.data.trigger && (_jsxs("p", { className: "text-sm mt-1", style: { color: theme.colors.textSecondary }, children: ["Trigger: ", _jsx("span", { className: "text-white", children: event.data.trigger })] })), event.data.reason && (_jsx("p", { className: "text-xs mt-1", style: { color: theme.colors.textMuted }, children: event.data.reason }))] }));
        }
        return null;
    };
    return (_jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: viewingFile ? (_jsx(AnimatedResizableLayout, { minSize: 30, leftPanel: _jsx("div", { style: { height: '100%', overflowY: 'auto', padding: '16px' }, children: _jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }, children: activeSegment && activeSegment.events ? (activeSegment.events
                        .filter((event) => event.type !== 'stop')
                        .map((event, index) => {
                        return (_jsx(AnimatedTimelineEvent, { event: event, isNew: newEventIds.has(event.id), renderContent: () => renderEventContent(event, new Date(event.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            })) }, `${activeSegment.segmentNumber}-${index}`));
                    })) : (_jsx("div", { style: {
                            textAlign: 'center',
                            padding: '32px 0',
                            color: theme.colors.textSecondary,
                        }, children: _jsx("p", { children: "No events in this segment" }) })) }) }), rightPanel: _jsxs("div", { style: {
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: `1px solid ${theme.colors.border}`,
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.backgroundSecondary,
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    minWidth: 0,
                                    flex: 1,
                                }, children: [_jsx("span", { style: {
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            color: theme.colors.text,
                                            whiteSpace: 'nowrap',
                                        }, children: viewingFile.split('/').pop() }), _jsx("span", { style: {
                                            fontSize: '12px',
                                            color: theme.colors.textSecondary,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }, children: viewingFile })] }), _jsx("button", { onClick: () => setViewingFile(null), style: {
                                    padding: '6px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: theme.colors.textSecondary,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundTertiary;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }, children: _jsx(X, { size: 16 }) })] }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(FileViewer, { filePath: viewingFile, onClose: () => setViewingFile(null) }) })] }) })) : (
        /* No file viewing - show full width timeline */
        _jsx("div", { style: { height: '100%', overflowY: 'auto', padding: '16px' }, children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: activeSegment && activeSegment.events ? (activeSegment.events
                    .filter((event) => event.type !== 'stop')
                    .map((event, index) => (_jsx(AnimatedTimelineEvent, { event: event, isNew: newEventIds.has(event.id), renderContent: () => renderEventContent(event, new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    })) }, `${activeSegment.segmentNumber}-${index}`)))) : (_jsx("div", { style: {
                        textAlign: 'center',
                        padding: '32px 0',
                        color: theme.colors.textSecondary,
                    }, children: _jsx("p", { children: "No events in this segment" }) })) }) })) }));
};
