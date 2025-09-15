import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { FileText, Edit, Search, List, Globe, Code, ChevronRight, ChevronDown, File, StopCircle, MessageCircle, Rocket, Flag } from 'lucide-react';
export const EventSegmentView = ({ segment, theme }) => {
    const [expandedEvents, setExpandedEvents] = useState(new Set());
    const [showRawEvents, setShowRawEvents] = useState(false);
    const [showPathDiagnostics, setShowPathDiagnostics] = useState(false);
    const toggleEvent = (index) => {
        const newExpanded = new Set(expandedEvents);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        }
        else {
            newExpanded.add(index);
        }
        setExpandedEvents(newExpanded);
    };
    const getToolIcon = (toolName) => {
        switch (toolName) {
            case 'Read':
            case 'NotebookRead':
                return _jsx(FileText, { size: 14 });
            case 'Write':
            case 'Edit':
            case 'MultiEdit':
            case 'NotebookEdit':
                return _jsx(Edit, { size: 14 });
            case 'Grep':
            case 'WebSearch':
                return _jsx(Search, { size: 14 });
            case 'LS':
            case 'Glob':
                return _jsx(List, { size: 14 });
            case 'WebFetch':
                return _jsx(Globe, { size: 14 });
            case 'Bash':
            case 'Task':
                return _jsx(Code, { size: 14 });
            default:
                return _jsx(File, { size: 14 });
        }
    };
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    };
    const getEventColor = (event) => {
        if (event.eventType === 'pre-tool-use')
            return theme.colors?.warning || '#f59e0b';
        if (event.eventType === 'post-tool-use')
            return theme.colors?.success || '#10b981';
        if (event.eventType === 'stop')
            return theme.colors?.danger || '#ef4444';
        if (event.eventType === 'notification')
            return theme.colors?.info || '#3b82f6';
        return theme.colors?.text?.secondary || '#6b7280';
    };
    const formatPath = (path, normalizedWorkingDir) => {
        // If it's already a relative path, return as-is
        if (!path.startsWith('/')) {
            return path;
        }
        // Try to make it relative to the normalized working directory
        if (normalizedWorkingDir && path.startsWith(normalizedWorkingDir)) {
            const relativePath = path.substring(normalizedWorkingDir.length);
            return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        }
        // If path is short enough, show it as-is
        if (path.length < 60) {
            return path;
        }
        const parts = path.split('/');
        // Check if it's in a project directory (common patterns)
        const projectIndicators = ['Developer', 'Projects', 'repos', 'github', 'src', 'workspace'];
        let projectIndex = -1;
        for (let i = 0; i < parts.length; i++) {
            if (projectIndicators.some(indicator => parts[i].toLowerCase().includes(indicator.toLowerCase()))) {
                projectIndex = i;
                break;
            }
        }
        // If we found a project directory, show from there
        if (projectIndex >= 0 && projectIndex < parts.length - 3) {
            return `.../${parts.slice(projectIndex + 1).join('/')}`;
        }
        // For very long paths, show first part and last 3 parts
        if (parts.length > 6) {
            return `${parts[1]}/.../${parts.slice(-3).join('/')}`;
        }
        // Default: show last 4 parts
        if (parts.length > 4) {
            return `.../${parts.slice(-4).join('/')}`;
        }
        return path;
    };
    // Helper to determine path quality/normalization status
    const getPathQuality = (event) => {
        if (!event.files || event.files.length === 0) {
            return {
                quality: 'missing',
                indicator: '⚠️',
                color: theme.colors?.warning || '#f59e0b',
                tooltip: 'No path information available'
            };
        }
        const firstFile = event.files[0];
        // Check if we have repository context (best case)
        if (firstFile.repository?.relativePath) {
            return {
                quality: 'normalized',
                indicator: '✓',
                color: theme.colors?.success || '#10b981',
                tooltip: 'Path normalized with repository context'
            };
        }
        // Check if we have a display path (normalization successful)
        if (firstFile.displayPath && firstFile.displayPath !== '[path not normalized]') {
            return {
                quality: 'partial',
                indicator: '~',
                color: theme.colors?.info || '#3b82f6',
                tooltip: 'Path partially normalized'
            };
        }
        // We only have raw paths
        return {
            quality: 'raw',
            indicator: '!',
            color: theme.colors?.textSecondary || '#6b7280',
            tooltip: 'Using raw path (not normalized)'
        };
    };
    const renderEventDetails = (event) => {
        const details = [];
        const pathQuality = getPathQuality(event);
        // Show Read operations with more detail
        if (event.toolName === 'Read' && event.toolInput) {
            const filePath = event.toolInput.file_path;
            const limit = event.toolInput.limit;
            const offset = event.toolInput.offset;
            if (filePath) {
                const output = event.toolOutput;
                const numLines = output?.file?.numLines || output?.numLines;
                const totalLines = output?.file?.totalLines || output?.totalLines;
                // Use normalized path from event.files if available
                const displayPath = event.files?.[0]?.displayPath ||
                    event.files?.[0]?.repository?.relativePath ||
                    filePath;
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                    }, children: [_jsxs("div", { style: { fontWeight: 500, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }, children: ["\uD83D\uDCD6 File Read", pathQuality.quality !== 'normalized' && (_jsx("span", { title: pathQuality.tooltip, style: {
                                        fontSize: '10px',
                                        color: pathQuality.color,
                                        cursor: 'help'
                                    }, children: pathQuality.indicator }))] }), _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                color: theme.colors.textSecondary,
                            }, children: [_jsx(File, { size: 10 }), formatPath(displayPath, event.normalizedWorkingDirectory)] }), event.eventType === 'post-tool-use' && numLines && (_jsxs("div", { style: { fontSize: '11px', color: theme.colors.textSecondary, marginTop: '4px' }, children: ["Read ", numLines, " lines", totalLines && ` of ${totalLines} total`, offset && ` (starting at line ${offset})`, limit && ` (limit: ${limit})`] }))] }, "read-operation"));
            }
        }
        else if (event.files && event.files.length > 0) {
            // Generic file path display for other tools
            const firstFile = event.files[0];
            const displayPath = firstFile.displayPath ||
                firstFile.repository?.relativePath ||
                '[path not normalized]';
            details.push(_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                }, children: [_jsx(File, { size: 12 }), _jsx("span", { children: formatPath(displayPath, event.normalizedWorkingDirectory) }), pathQuality.quality !== 'normalized' && (_jsx("span", { title: pathQuality.tooltip, style: {
                            fontSize: '10px',
                            color: pathQuality.color,
                            cursor: 'help',
                            marginLeft: '4px'
                        }, children: pathQuality.indicator }))] }, "primary-path"));
            // Show additional files if present
            if (event.files.length > 1) {
                details.push(_jsxs("div", { style: {
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        marginTop: '4px',
                        marginLeft: '20px'
                    }, children: ["+", event.files.length - 1, " more file", event.files.length > 2 ? 's' : ''] }, "additional-files"));
            }
        }
        // Show tool input for specific tools
        if (event.toolName === 'Bash' && event.toolInput) {
            const command = event.toolInput.command;
            if (command) {
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                    }, children: ["$ ", command] }, "bash-command"));
            }
        }
        // Show Glob pattern searches
        if (event.toolName === 'Glob' && event.toolInput) {
            const pattern = event.toolInput.pattern;
            const path = event.toolInput.path;
            if (pattern) {
                const output = event.toolOutput;
                const filenames = output?.filenames || [];
                const numFiles = output?.numFiles || 0;
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                    }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "\uD83D\uDD0D File Pattern Search" }), _jsxs("div", { style: { fontFamily: 'monospace' }, children: ["Pattern: ", pattern] }), path && _jsxs("div", { style: { fontFamily: 'monospace', fontSize: '11px', color: theme.colors.textSecondary }, children: ["Path: ", path] }), event.eventType === 'post-tool-use' && output && (_jsxs("div", { style: { marginTop: '4px', fontSize: '11px' }, children: [_jsxs("div", { style: { color: numFiles > 0 ? theme.colors.success || '#10b981' : theme.colors.textSecondary }, children: ["Found: ", numFiles > 0 ? `${numFiles} file${numFiles > 1 ? 's' : ''}` : 'No matches'] }), filenames.length > 0 && (_jsxs("div", { style: { marginTop: '4px', paddingLeft: '8px', color: theme.colors.textSecondary }, children: [filenames.slice(0, 3).map((file, i) => (_jsxs("div", { style: { fontSize: '10px', fontFamily: 'monospace' }, children: ["\u2022 ", formatPath(file, event.normalizedWorkingDirectory)] }, i))), filenames.length > 3 && (_jsxs("div", { style: { fontSize: '10px', fontStyle: 'italic' }, children: ["...and ", filenames.length - 3, " more"] }))] }))] }))] }, "glob-pattern"));
            }
        }
        // Show Grep searches
        if (event.toolName === 'Grep' && event.toolInput) {
            const pattern = event.toolInput.pattern;
            const glob = event.toolInput.glob;
            const path = event.toolInput.path;
            const outputMode = event.toolInput.output_mode;
            if (pattern) {
                const output = event.toolOutput;
                const numLines = output?.numLines || 0;
                const numFiles = output?.numFiles || 0;
                const content = output?.content;
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                    }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "\uD83D\uDD0E Text Search" }), _jsxs("div", { style: { fontFamily: 'monospace', fontSize: '11px' }, children: ["Pattern: ", pattern] }), glob && _jsxs("div", { style: { fontFamily: 'monospace', fontSize: '11px', color: theme.colors.textSecondary }, children: ["Files: ", glob] }), path && _jsxs("div", { style: { fontFamily: 'monospace', fontSize: '11px', color: theme.colors.textSecondary }, children: ["In: ", formatPath(path, event.normalizedWorkingDirectory)] }), event.eventType === 'post-tool-use' && output && (_jsxs("div", { style: { marginTop: '4px', fontSize: '11px' }, children: [_jsx("div", { style: { color: (numLines > 0 || numFiles > 0) ? theme.colors.success || '#10b981' : theme.colors.textSecondary }, children: outputMode === 'files_with_matches'
                                        ? `Found in ${numFiles} file${numFiles !== 1 ? 's' : ''}`
                                        : numLines > 0
                                            ? `Found ${numLines} match${numLines !== 1 ? 'es' : ''}`
                                            : 'No matches found' }), content && outputMode === 'content' && (_jsxs("div", { style: {
                                        marginTop: '4px',
                                        padding: '4px',
                                        backgroundColor: theme.colors?.background || '#ffffff',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace',
                                        fontSize: '10px',
                                        color: theme.colors.textSecondary,
                                        maxHeight: '100px',
                                        overflow: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                    }, children: [content.substring(0, 200), content.length > 200 ? '...' : ''] }))] }))] }, "grep-search"));
            }
        }
        // Show LS directory listings
        if (event.toolName === 'LS' && event.toolInput) {
            const path = event.toolInput.path;
            if (path) {
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                    }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "\uD83D\uDCC1 Directory Listing" }), _jsx("div", { style: { fontFamily: 'monospace' }, children: formatPath(path, event.normalizedWorkingDirectory) })] }, "ls-listing"));
            }
        }
        // Show Edit/Write operations
        if ((event.toolName === 'Edit' || event.toolName === 'MultiEdit') && event.toolInput) {
            const input = event.toolInput;
            details.push(_jsxs("div", { style: {
                    padding: '8px',
                    backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: theme.colors.text,
                    marginTop: '8px',
                }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "\u270F\uFE0F File Edit" }), input.old_string && (_jsxs("div", { style: {
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            marginTop: '4px',
                            maxHeight: '100px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }, children: ["Changed: ", input.old_string.substring(0, 50), "..."] })), input.edits && Array.isArray(input.edits) && (_jsxs("div", { style: { fontSize: '11px', color: theme.colors.textSecondary }, children: [input.edits.length, " edits made"] }))] }, "edit-operation"));
        }
        if (event.toolName === 'Write' && event.toolInput) {
            const input = event.toolInput;
            const content = input.content || '';
            const lines = content.split('\n').length;
            details.push(_jsxs("div", { style: {
                    padding: '8px',
                    backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: theme.colors.text,
                    marginTop: '8px',
                }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "\uD83D\uDCDD File Write" }), _jsxs("div", { style: { fontSize: '11px', color: theme.colors.textSecondary }, children: ["Wrote ", lines, " lines (", content.length, " characters)"] })] }, "write-operation"));
        }
        if (event.toolName === 'TodoWrite' && event.toolInput) {
            const todos = event.toolInput.todos;
            if (todos && Array.isArray(todos)) {
                const inProgress = todos.filter((t) => t.status === 'in_progress');
                const completed = todos.filter((t) => t.status === 'completed');
                const pending = todos.filter((t) => t.status === 'pending');
                details.push(_jsxs("div", { style: {
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                        marginTop: '8px',
                    }, children: [_jsxs("div", { children: ["\uD83D\uDCCB Todos: ", completed.length, " completed, ", inProgress.length, " active, ", pending.length, " pending"] }), inProgress.length > 0 && (_jsxs("div", { style: { marginTop: '4px', paddingLeft: '16px' }, children: ["Active: ", inProgress[0].content] }))] }, "todos"));
            }
        }
        // Show WebSearch and WebFetch
        if (event.toolName === 'WebSearch' && event.toolInput) {
            const query = event.toolInput.query;
            if (query) {
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                    }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "\uD83C\uDF10 Web Search" }), _jsxs("div", { style: { fontFamily: 'monospace', fontSize: '11px' }, children: ["Query: ", query] })] }, "web-search"));
            }
        }
        if (event.toolName === 'WebFetch' && event.toolInput) {
            const url = event.toolInput.url;
            if (url) {
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                    }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "\uD83C\uDF10 Web Fetch" }), _jsxs("div", { style: {
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                wordBreak: 'break-all',
                            }, children: ["URL: ", url] })] }, "web-fetch"));
            }
        }
        // Show output for post-tool events (for Bash commands)
        if (event.eventType === 'post-tool-use' && event.toolOutput && event.toolName === 'Bash') {
            const output = event.toolOutput;
            if (output.stdout) {
                const preview = output.stdout.substring(0, 200);
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        marginTop: '8px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                    }, children: ["Output: ", preview, output.stdout.length > 200 ? '...' : ''] }, "output"));
            }
        }
        // Show stop event details
        if (event.eventType === 'stop') {
            const stopHookActive = event.raw?.stop_hook_active;
            details.push(_jsxs("div", { style: {
                    padding: '8px',
                    backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: theme.colors.text,
                    marginTop: '8px',
                    border: `1px solid ${theme.colors?.danger || '#ef4444'}`,
                }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px', color: theme.colors?.danger || '#ef4444' }, children: "\uD83D\uDED1 Session Stop" }), _jsxs("div", { style: { fontSize: '11px', color: theme.colors.textSecondary }, children: [stopHookActive !== undefined && (_jsxs("div", { children: ["Stop hook: ", stopHookActive ? 'Active' : 'Inactive'] })), _jsx("div", { style: { marginTop: '4px' }, children: "This marks a pause or end in the AI's processing" })] })] }, "stop-event"));
        }
        // Show notification event details
        if (event.eventType === 'notification') {
            const message = event.data?.message || event.raw?.message;
            if (message) {
                details.push(_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.text,
                        marginTop: '8px',
                        border: `1px solid ${theme.colors?.info || '#3b82f6'}`,
                    }, children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px', color: theme.colors?.info || '#3b82f6' }, children: "\uD83D\uDCAC Notification" }), _jsxs("div", { style: {
                                fontSize: '11px',
                                color: theme.colors.textSecondary,
                                fontStyle: 'italic',
                            }, children: ["\"", message, "\""] })] }, "notification-event"));
            }
        }
        // Show subagent events
        if (event.eventType === 'subagent-start' || event.eventType === 'subagent-stop') {
            const isStart = event.eventType === 'subagent-start';
            const agentData = event.data;
            details.push(_jsxs("div", { style: {
                    padding: '8px',
                    backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: theme.colors.text,
                    marginTop: '8px',
                    border: `1px solid ${isStart ? theme.colors?.success || '#10b981' : theme.colors?.warning || '#f59e0b'}`,
                }, children: [_jsx("div", { style: {
                            fontWeight: 500,
                            marginBottom: '4px',
                            color: isStart ? theme.colors?.success || '#10b981' : theme.colors?.warning || '#f59e0b'
                        }, children: isStart ? '🚀 Subagent Started' : '🏁 Subagent Stopped' }), agentData && (_jsxs("div", { style: { fontSize: '11px', color: theme.colors.textSecondary }, children: [agentData.agent_type && _jsxs("div", { children: ["Type: ", agentData.agent_type] }), agentData.description && _jsxs("div", { children: ["Task: ", agentData.description] }), agentData.prompt && (_jsxs("div", { style: { marginTop: '4px', fontStyle: 'italic' }, children: ["\"", agentData.prompt.substring(0, 100), agentData.prompt.length > 100 ? '...' : '', "\""] }))] }))] }, "subagent-event"));
        }
        // Add path diagnostics if enabled and we have path issues
        if (showPathDiagnostics && event.files && event.files.length > 0 && pathQuality.quality !== 'normalized') {
            details.push(_jsxs("div", { style: {
                    padding: '8px',
                    backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: theme.colors.textSecondary,
                    marginTop: '8px',
                    border: `1px solid ${pathQuality.color}`,
                }, children: [_jsxs("div", { style: { fontWeight: 500, marginBottom: '4px', color: pathQuality.color }, children: ["\uD83D\uDD0D Path Diagnostics (", pathQuality.quality, ")"] }), _jsx("div", { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' }, children: JSON.stringify({
                            files: event.files.map(f => ({
                                displayPath: f.displayPath,
                                repository: f.repository,
                                context: f.context
                            })),
                            operation: event.operation,
                            normalizedWorkingDir: event.normalizedWorkingDirectory,
                            workingDir: event.workingDirectory
                        }, null, 2) })] }, "path-diagnostics"));
        }
        return details;
    };
    // Calculate path quality statistics for the segment
    const pathStats = useMemo(() => {
        const stats = { normalized: 0, partial: 0, raw: 0, missing: 0, total: 0 };
        segment.events.forEach(event => {
            if (event.toolName && ['Read', 'Write', 'Edit', 'MultiEdit', 'Grep', 'Glob', 'LS'].includes(event.toolName)) {
                stats.total++;
                const quality = getPathQuality(event);
                stats[quality.quality]++;
            }
        });
        return stats;
    }, [segment.events]);
    return (_jsxs("div", { style: { padding: '16px' }, children: [pathStats.total > 0 && (pathStats.raw > 0 || pathStats.missing > 0 || pathStats.partial > 0) && (_jsxs("div", { style: {
                    padding: '8px',
                    backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }, children: [_jsx("div", { style: { fontWeight: 500, color: theme.colors.textSecondary }, children: "Path Quality:" }), pathStats.normalized > 0 && (_jsxs("span", { style: { color: theme.colors?.success || '#10b981' }, children: ["\u2713 ", pathStats.normalized, " normalized"] })), pathStats.partial > 0 && (_jsxs("span", { style: { color: theme.colors?.info || '#3b82f6' }, children: ["~ ", pathStats.partial, " partial"] })), pathStats.raw > 0 && (_jsxs("span", { style: { color: theme.colors?.textSecondary || '#6b7280' }, children: ["! ", pathStats.raw, " raw"] })), pathStats.missing > 0 && (_jsxs("span", { style: { color: theme.colors?.warning || '#f59e0b' }, children: ["\u26A0\uFE0F ", pathStats.missing, " missing"] }))] })), _jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px',
                }, children: [Object.keys(segment.stats.toolCounts).length > 0 && (_jsxs("div", { style: {
                            padding: '12px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '8px',
                        }, children: [_jsx("div", { style: {
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: theme.colors.textSecondary,
                                    marginBottom: '8px',
                                }, children: "Tool Usage" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' }, children: Object.entries(segment.stats.toolCounts).map(([tool, count]) => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        backgroundColor: theme.colors.background,
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                    }, children: [getToolIcon(tool), _jsx("span", { children: tool }), _jsxs("span", { style: { color: theme.colors.textSecondary }, children: ["\u00D7", count] })] }, tool))) })] })), segment.stats.filesAccessed.length > 0 && (_jsxs("div", { style: {
                            padding: '12px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '8px',
                        }, children: [_jsxs("div", { style: {
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: theme.colors.textSecondary,
                                    marginBottom: '8px',
                                }, children: ["Files Accessed (", segment.stats.filesAccessed.length, ")"] }), _jsxs("div", { style: { fontSize: '12px' }, children: [segment.stats.filesAccessed.slice(0, 3).map((file, i) => (_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '2px 0',
                                            color: theme.colors.text,
                                        }, children: [_jsx(File, { size: 10 }), _jsx("span", { style: {
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }, children: file.split('/').pop() })] }, i))), segment.stats.filesAccessed.length > 3 && (_jsxs("div", { style: { color: theme.colors.textSecondary, marginTop: '4px' }, children: ["+", segment.stats.filesAccessed.length - 3, " more files"] }))] })] })), segment.stats.fileWrites.length > 0 && (_jsxs("div", { style: {
                            padding: '12px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '8px',
                        }, children: [_jsxs("div", { style: {
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: theme.colors.textSecondary,
                                    marginBottom: '8px',
                                }, children: ["Files Modified (", segment.stats.fileWrites.length, ")"] }), _jsx("div", { style: { fontSize: '12px' }, children: segment.stats.fileWrites.slice(0, 3).map((file, i) => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '2px 0',
                                        color: theme.colors.warning,
                                    }, children: [_jsx(Edit, { size: 10 }), _jsx("span", { style: {
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }, children: file.split('/').pop() })] }, i))) })] }))] }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                }, children: [_jsx("div", { style: {
                            fontSize: '14px',
                            fontWeight: 500,
                            color: theme.colors.text,
                        }, children: "Event Timeline" }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx("button", { onClick: () => setShowPathDiagnostics(!showPathDiagnostics), style: {
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.colors.border}`,
                                    backgroundColor: showPathDiagnostics ? theme.colors.warning : 'transparent',
                                    color: showPathDiagnostics ? '#fff' : theme.colors.text,
                                    cursor: 'pointer',
                                }, title: "Show detailed path information for debugging", children: "\uD83D\uDD0D Paths" }), _jsx("button", { onClick: () => setShowRawEvents(!showRawEvents), style: {
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.colors.border}`,
                                    backgroundColor: showRawEvents ? theme.colors.primary : 'transparent',
                                    color: showRawEvents ? '#fff' : theme.colors.text,
                                    cursor: 'pointer',
                                }, children: showRawEvents ? 'Hide Details' : 'Show Details' })] })] }), showRawEvents && (_jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '8px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                }, children: segment.events.map((event, index) => (_jsxs("div", { style: {
                        padding: '8px',
                        backgroundColor: theme.colors.background,
                        borderRadius: '6px',
                        borderLeft: `3px solid ${getEventColor(event)}`,
                    }, children: [_jsxs("div", { onClick: () => toggleEvent(index), style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                            }, children: [expandedEvents.has(index) ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        flex: 1,
                                    }, children: [event.toolName ? getToolIcon(event.toolName) :
                                            event.eventType === 'stop' ? _jsx(StopCircle, { size: 14 }) :
                                                event.eventType === 'notification' ? _jsx(MessageCircle, { size: 14 }) :
                                                    event.eventType === 'subagent-start' ? _jsx(Rocket, { size: 14 }) :
                                                        event.eventType === 'subagent-stop' ? _jsx(Flag, { size: 14 }) :
                                                            null, _jsx("span", { style: {
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: theme.colors.text,
                                            }, children: event.toolName ||
                                                (event.eventType === 'stop' ? 'Stop' :
                                                    event.eventType === 'notification' ? 'Notification' :
                                                        event.eventType === 'subagent-start' ? 'Subagent Start' :
                                                            event.eventType === 'subagent-stop' ? 'Subagent Stop' :
                                                                event.eventType) }), _jsx("span", { style: {
                                                fontSize: '11px',
                                                color: theme.colors.textSecondary,
                                                marginLeft: 'auto',
                                            }, children: formatTimestamp(event.timestamp) })] })] }), expandedEvents.has(index) && (_jsx("div", { style: {
                                marginTop: '8px',
                                paddingLeft: '22px',
                            }, children: renderEventDetails(event) }))] }, index))) }))] }));
};
