import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Clock, FolderTree, MapPin, Eye, EyeOff, Target, Layers, CheckCircle2, FileText, ChevronRight, Filter, Search, X } from 'lucide-react';
import { filterNotesBySession, filterNotesByPath, calculateNoteCoverage } from '../../../shared/utils/noteFiltering';
export const FilteredRepositoryNotesPanel = ({ notes, sessions, sessionFileActivities, selectedSessionId, remoteUrl, onNoteToggle, selectedNoteIds = new Set(), repository, onNotesUpdated, }) => {
    const { theme } = useTheme();
    const [filterMode, setFilterMode] = useState('all');
    const [showParentNotes, setShowParentNotes] = useState(true);
    const [groupByDepth, setGroupByDepth] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [showFileSelector, setShowFileSelector] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Auto-switch to active mode when a session is selected from outside
    useEffect(() => {
        if (selectedSessionId && filterMode === 'all') {
            setFilterMode('active');
        }
        // Clear selected files when session changes
        setSelectedFiles(new Set());
        setShowFileSelector(false);
    }, [selectedSessionId]);
    // Get session file paths for filtering
    const sessionFilePaths = useMemo(() => {
        if (!selectedSessionId) {
            console.log('[FilteredNotes] No selectedSessionId');
            return [];
        }
        console.log('[FilteredNotes] Looking for activities for session:', selectedSessionId);
        console.log('[FilteredNotes] sessionFileActivities Map size:', sessionFileActivities.size);
        console.log('[FilteredNotes] sessionFileActivities keys (sourceIds):', Array.from(sessionFileActivities.keys()));
        // sessionFileActivities is keyed by sourceId, not sessionId
        // We need to look through all sources to find activities for this session
        const paths = new Set();
        sessionFileActivities.forEach((activities, sourceId) => {
            console.log(`[FilteredNotes] Checking source ${sourceId} with ${activities.length} activities`);
            activities.forEach(activity => {
                if (activity.sessionId === selectedSessionId) {
                    console.log('[FilteredNotes] Found matching activity:', activity.filePath);
                    if (activity.filePath) {
                        // Ensure consistent path format (no leading slash)
                        let normalizedPath = activity.filePath;
                        if (normalizedPath.startsWith('/')) {
                            normalizedPath = normalizedPath.substring(1);
                        }
                        paths.add(normalizedPath);
                    }
                }
            });
        });
        const result = Array.from(paths);
        console.log('[FilteredNotes] Total paths extracted for session:', result.length, result);
        return result;
    }, [selectedSessionId, sessionFileActivities]);
    // Filter notes based on current mode
    const { filteredNotes, coverage } = useMemo(() => {
        if (filterMode === 'all' || !selectedSessionId) {
            // Show all notes when in 'all' mode or no session selected
            return {
                filteredNotes: notes.map(n => ({ ...n, relevance: 'none' })),
                coverage: calculateNoteCoverage(notes, notes, sessionFilePaths)
            };
        }
        // In active mode with a session selected
        if (sessionFilePaths.length === 0) {
            // Session has no file activities - show no notes
            return {
                filteredNotes: [],
                coverage: {
                    totalNotes: notes.length,
                    relevantNotes: 0,
                    exactMatches: 0,
                    parentMatches: 0,
                    coveragePercent: 0,
                    filesCovered: 0,
                    totalFiles: 0
                }
            };
        }
        // Filter by active session - use selected files if any, otherwise all session files
        const pathsToFilter = selectedFiles.size > 0
            ? Array.from(selectedFiles)
            : sessionFilePaths;
        console.log('[FilteredNotes] Filtering notes:');
        console.log('  - Paths to filter:', pathsToFilter);
        console.log('  - Total notes available:', notes.length);
        console.log('  - Note paths:', notes.map(n => n.relativePath));
        console.log('  - Include parent notes:', showParentNotes);
        const result = filterNotesBySession(notes, pathsToFilter, showParentNotes);
        console.log('[FilteredNotes] Filter result:', result.filteredNotes.length, 'notes matched');
        return result;
    }, [notes, filterMode, selectedSessionId, sessionFilePaths, selectedFiles, showParentNotes]);
    // Apply search filter on top of other filters
    const searchFilteredNotes = useMemo(() => {
        if (!searchQuery.trim()) {
            return filteredNotes;
        }
        const query = searchQuery.toLowerCase().trim();
        return filteredNotes.filter(note => {
            // Search in note content
            if (note.note.toLowerCase().includes(query))
                return true;
            // Search in path
            if (note.relativePath.toLowerCase().includes(query))
                return true;
            // Search in metadata
            if (note.metadata) {
                const metadataString = JSON.stringify(note.metadata).toLowerCase();
                if (metadataString.includes(query))
                    return true;
            }
            // Search in tags
            if (note.tags?.some(tag => tag.toLowerCase().includes(query)))
                return true;
            return false;
        });
    }, [filteredNotes, searchQuery]);
    // Group notes by depth level for better visualization
    const notesByDepth = useMemo(() => {
        const groups = new Map();
        searchFilteredNotes.forEach(note => {
            const depth = note.pathDistance ?? -1;
            if (!groups.has(depth)) {
                groups.set(depth, []);
            }
            groups.get(depth).push(note);
        });
        // Sort by depth (0 first, then 1, 2, 3, etc.)
        return Array.from(groups.entries())
            .sort((a, b) => {
            if (a[0] === -1)
                return 1; // Put "none" relevance at the end
            if (b[0] === -1)
                return -1;
            return a[0] - b[0];
        });
    }, [searchFilteredNotes]);
    // Calculate which files each note applies to
    const getFilesForNote = (note) => {
        if (!sessionFilePaths.length)
            return [];
        // For exact matches, return the file itself
        if (note.pathDistance === 0) {
            return sessionFilePaths.filter(fp => fp === note.relativePath);
        }
        // For parent notes, find all files under that directory
        if (note.isParentDirectory) {
            const notePath = note.relativePath === '.' ? '' : note.relativePath;
            return sessionFilePaths.filter(fp => {
                if (notePath === '')
                    return true; // Root applies to all
                return fp.startsWith(notePath + '/');
            });
        }
        return [];
    };
    // Get session info for display
    const selectedSession = sessions.find(s => s.sessionId === selectedSessionId);
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '16px',
            height: '100%',
            overflow: 'hidden'
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundLight,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                }, children: [_jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsxs("button", { onClick: () => setFilterMode('all'), style: {
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '6px',
                                    border: filterMode === 'all' ? 'none' : `1px solid ${theme.colors.border}`,
                                    backgroundColor: filterMode === 'all' ? theme.colors.primary : theme.colors.backgroundSecondary,
                                    color: filterMode === 'all' ? 'white' : theme.colors.text,
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                }, children: [_jsx(Layers, { size: 14 }), "All Notes"] }), _jsxs("button", { onClick: () => setFilterMode('active'), style: {
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '6px',
                                    border: filterMode === 'active' ? 'none' : `1px solid ${theme.colors.border}`,
                                    backgroundColor: filterMode === 'active' ? theme.colors.primary : theme.colors.backgroundSecondary,
                                    color: filterMode === 'active' ? 'white' : theme.colors.text,
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    opacity: selectedSessionId ? 1 : 0.5,
                                }, disabled: !selectedSessionId, title: selectedSessionId ? `Show notes for session: ${selectedSession?.customName || selectedSessionId.substring(0, 8)}` : 'No session selected', children: [_jsx(Target, { size: 14 }), "Session Context"] })] }), _jsxs("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                        }, children: [_jsxs("div", { style: {
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                }, children: [_jsx(Search, { size: 14, style: {
                                            position: 'absolute',
                                            left: '10px',
                                            color: theme.colors.textSecondary,
                                            pointerEvents: 'none'
                                        } }), _jsx("input", { type: "text", placeholder: "Search notes...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
                                            width: '100%',
                                            padding: '6px 30px 6px 32px',
                                            backgroundColor: theme.colors.backgroundSecondary,
                                            border: `1px solid ${theme.colors.border}`,
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            color: theme.colors.text,
                                            outline: 'none',
                                        } }), searchQuery && (_jsx("button", { onClick: () => setSearchQuery(''), style: {
                                            position: 'absolute',
                                            right: '8px',
                                            padding: '2px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: theme.colors.textSecondary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }, children: _jsx(X, { size: 14 }) }))] }), searchQuery && (_jsx("div", { style: {
                                    fontSize: '11px',
                                    color: searchFilteredNotes.length > 0 ? theme.colors.textSecondary : theme.colors.warning,
                                    paddingLeft: '4px',
                                }, children: searchFilteredNotes.length === 0
                                    ? 'No matches found'
                                    : `${searchFilteredNotes.length} of ${filteredNotes.length} notes match` }))] }), filterMode === 'active' && selectedSession && (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                    padding: '8px',
                                    backgroundColor: theme.colors.primary + '11',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: theme.colors.text,
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Target, { size: 14, color: theme.colors.primary }), _jsx("span", { children: "Filtering by session:" }), _jsx("strong", { children: selectedSession.customName || selectedSession.sessionId.substring(0, 8) }), selectedSession.fileAccessCount && (_jsxs("span", { style: { color: theme.colors.textSecondary }, children: ["\u2022 ", selectedSession.fileAccessCount, " files accessed"] }))] }), sessionFilePaths.length > 0 && (_jsxs("button", { onClick: () => setShowFileSelector(!showFileSelector), style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            backgroundColor: selectedFiles.size > 0
                                                ? theme.colors.primary
                                                : 'transparent',
                                            border: `1px solid ${theme.colors.primary}`,
                                            borderRadius: '4px',
                                            color: selectedFiles.size > 0 ? 'white' : theme.colors.primary,
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }, children: [_jsx(Filter, { size: 12 }), selectedFiles.size > 0
                                                ? `${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} selected`
                                                : 'Filter by files', _jsx(ChevronRight, { size: 12, style: {
                                                    transform: showFileSelector ? 'rotate(90deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s'
                                                } })] }))] }), showFileSelector && sessionFilePaths.length > 0 && (_jsxs("div", { style: {
                                    backgroundColor: theme.colors.backgroundLight,
                                    borderRadius: '4px',
                                    border: `1px solid ${theme.colors.border}`,
                                    padding: '8px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: '8px',
                                            paddingBottom: '8px',
                                            borderBottom: `1px solid ${theme.colors.border}`,
                                        }, children: [_jsx("span", { style: { fontSize: '11px', color: theme.colors.textSecondary, fontWeight: 600 }, children: "SELECT FILES TO FILTER" }), _jsxs("div", { style: { display: 'flex', gap: '4px' }, children: [_jsx("button", { onClick: () => setSelectedFiles(new Set(sessionFilePaths)), style: {
                                                            padding: '2px 6px',
                                                            fontSize: '10px',
                                                            backgroundColor: 'transparent',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: '3px',
                                                            color: theme.colors.text,
                                                            cursor: 'pointer',
                                                        }, children: "Select All" }), _jsx("button", { onClick: () => setSelectedFiles(new Set()), style: {
                                                            padding: '2px 6px',
                                                            fontSize: '10px',
                                                            backgroundColor: 'transparent',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: '3px',
                                                            color: theme.colors.text,
                                                            cursor: 'pointer',
                                                        }, children: "Clear" })] })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '4px' }, children: sessionFilePaths.map(filePath => {
                                            const isSelected = selectedFiles.has(filePath);
                                            // Count notes that would match this file
                                            const fileNotes = filterNotesByPath(notes, filePath, showParentNotes);
                                            return (_jsxs("label", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '6px',
                                                    backgroundColor: isSelected
                                                        ? theme.colors.primary + '11'
                                                        : 'transparent',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    transition: 'all 0.15s',
                                                }, onMouseEnter: (e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                }, children: [_jsx("input", { type: "checkbox", checked: isSelected, onChange: (e) => {
                                                            const newSelected = new Set(selectedFiles);
                                                            if (e.target.checked) {
                                                                newSelected.add(filePath);
                                                            }
                                                            else {
                                                                newSelected.delete(filePath);
                                                            }
                                                            setSelectedFiles(newSelected);
                                                        }, style: { cursor: 'pointer' } }), _jsx(FileText, { size: 12, color: theme.colors.primary }), _jsx("span", { style: {
                                                            flex: 1,
                                                            fontFamily: 'monospace',
                                                            fontSize: '11px',
                                                            color: isSelected ? theme.colors.text : theme.colors.textSecondary,
                                                        }, children: filePath }), _jsxs("span", { style: {
                                                            fontSize: '10px',
                                                            color: theme.colors.textTertiary,
                                                            padding: '2px 4px',
                                                            backgroundColor: theme.colors.backgroundTertiary,
                                                            borderRadius: '3px',
                                                        }, children: [fileNotes.length, " note", fileNotes.length !== 1 ? 's' : ''] })] }, filePath));
                                        }) })] }))] })), filterMode !== 'all' && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("label", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '12px',
                                            color: theme.colors.text,
                                            cursor: 'pointer',
                                        }, children: [_jsx("input", { type: "checkbox", checked: showParentNotes, onChange: (e) => setShowParentNotes(e.target.checked), style: { cursor: 'pointer' } }), "Include parent directory notes"] }), sessionFilePaths.length > 0 && (_jsxs("label", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '12px',
                                            color: theme.colors.text,
                                            cursor: 'pointer',
                                        }, children: [_jsx("input", { type: "checkbox", checked: groupByDepth, onChange: (e) => setGroupByDepth(e.target.checked), style: { cursor: 'pointer' } }), "Group by depth"] }))] }), selectedSessionId && (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '12px',
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary,
                                }, children: [selectedFiles.size > 0 && (_jsxs("span", { style: {
                                            color: theme.colors.warning,
                                            fontWeight: 600,
                                        }, children: ["Filtered: ", selectedFiles.size, "/", sessionFilePaths.length, " files"] })), _jsxs("span", { children: [coverage.relevantNotes, " / ", coverage.totalNotes, " notes"] }), coverage.filesCovered !== undefined && (_jsxs("span", { children: [coverage.filesCovered, " / ", coverage.totalFiles, " files covered"] })), _jsxs("span", { style: {
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: theme.colors.primary + '22',
                                            color: theme.colors.primary,
                                            fontWeight: 600,
                                        }, children: [coverage.coveragePercent, "%"] })] }))] }))] }), _jsx("div", { style: {
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }, children: searchFilteredNotes.length === 0 ? (_jsx("div", { style: {
                        backgroundColor: theme.colors.backgroundLight,
                        borderRadius: '8px',
                        padding: '16px',
                        border: `1px solid ${theme.colors.border}`,
                    }, children: searchQuery ? (_jsxs("div", { style: {
                            textAlign: 'center',
                            padding: '8px',
                            color: theme.colors.textSecondary,
                            fontSize: '14px',
                        }, children: ["No notes match your search \"", searchQuery, "\""] })) : filterMode === 'all' ? (_jsx("div", { style: {
                            textAlign: 'center',
                            padding: '8px',
                            color: theme.colors.textSecondary,
                            fontSize: '14px',
                        }, children: "No tribal knowledge notes yet" })) : sessionFilePaths.length === 0 ? (_jsx("div", { style: {
                            textAlign: 'center',
                            padding: '8px',
                            color: theme.colors.textSecondary,
                            fontSize: '14px',
                        }, children: "This session has no file activities recorded" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                    marginBottom: '12px',
                                    paddingBottom: '12px',
                                    borderBottom: `1px solid ${theme.colors.border}`,
                                }, children: [_jsx("div", { style: {
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '4px',
                                        }, children: selectedFiles.size > 0
                                            ? `No notes match the ${selectedFiles.size} selected file${selectedFiles.size > 1 ? 's' : ''}`
                                            : `No notes match these ${sessionFilePaths.length} session file${sessionFilePaths.length > 1 ? 's' : ''}` }), _jsx("div", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                        }, children: "Consider adding tribal knowledge notes to provide context for future sessions" })] }), _jsx("div", { style: {
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary,
                                    marginBottom: '8px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }, children: "Files touched by this session:" }), _jsx("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                }, children: (selectedFiles.size > 0 ? Array.from(selectedFiles) : sessionFilePaths).map(filePath => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                    }, children: [_jsx(FileText, { size: 14, color: theme.colors.primary }), _jsx("span", { style: {
                                                fontFamily: 'monospace',
                                                fontSize: '11px',
                                                color: theme.colors.text,
                                            }, children: filePath })] }, filePath))) })] })) })) : groupByDepth && filterMode !== 'all' ? (
                // Grouped by depth view
                notesByDepth.map(([depth, depthNotes]) => (_jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundLight,
                        borderRadius: '8px',
                        padding: '12px',
                        border: `1px solid ${theme.colors.border}`,
                    }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '12px',
                                paddingBottom: '8px',
                                borderBottom: `1px solid ${theme.colors.border}`,
                            }, children: [_jsx("div", { style: {
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: depth === 0
                                            ? theme.colors.success + '22'
                                            : depth === -1
                                                ? theme.colors.backgroundTertiary
                                                : theme.colors.warning + '22',
                                        color: depth === 0
                                            ? theme.colors.success
                                            : depth === -1
                                                ? theme.colors.textSecondary
                                                : theme.colors.warning,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                    }, children: depth === -1 ? '?' : depth }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '13px', fontWeight: 600, color: theme.colors.text }, children: depth === 0 ? 'Exact Matches' :
                                                depth === -1 ? 'Other Notes' :
                                                    `Parent Level ${depth}` }), _jsxs("div", { style: { fontSize: '11px', color: theme.colors.textSecondary }, children: [depthNotes.length, " note", depthNotes.length > 1 ? 's' : '', depth > 0 && ` • ${depth} level${depth > 1 ? 's' : ''} up from session files`] })] })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: depthNotes.map(note => (_jsxs("div", { style: {
                                    backgroundColor: selectedNoteIds.has(note.id)
                                        ? theme.colors.primary + '11'
                                        : theme.colors.backgroundSecondary,
                                    borderRadius: '6px',
                                    padding: '10px',
                                    border: `1px solid ${selectedNoteIds.has(note.id)
                                        ? theme.colors.primary
                                        : theme.colors.border}`,
                                    cursor: onNoteToggle ? 'pointer' : 'default',
                                    transition: 'all 0.2s',
                                }, onClick: () => onNoteToggle?.(note.id), children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }, children: [selectedNoteIds.has(note.id) && (_jsx(CheckCircle2, { size: 12, color: theme.colors.primary })), _jsx(FolderTree, { size: 12, color: theme.colors.primary }), _jsx("span", { style: { fontSize: '11px', color: theme.colors.primary, fontFamily: 'monospace' }, children: note.relativePath || '/' })] }), _jsx("p", { style: { fontSize: '12px', color: theme.colors.text, margin: 0, lineHeight: '1.4' }, children: note.note }), (() => {
                                        const applicableFiles = getFilesForNote(note);
                                        if (applicableFiles.length > 0 && applicableFiles.length <= 3) {
                                            return (_jsxs("div", { style: {
                                                    marginTop: '6px',
                                                    paddingTop: '6px',
                                                    borderTop: `1px solid ${theme.colors.border}`,
                                                    fontSize: '10px',
                                                    color: theme.colors.textSecondary,
                                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }, children: [_jsx(MapPin, { size: 10 }), _jsx("span", { children: "Applies to:" })] }), applicableFiles.map((file, idx) => (_jsx("div", { style: {
                                                            marginLeft: '14px',
                                                            fontFamily: 'monospace',
                                                            color: theme.colors.primary + 'aa',
                                                        }, children: file }, idx)))] }));
                                        }
                                        else if (applicableFiles.length > 3) {
                                            return (_jsxs("div", { style: {
                                                    marginTop: '6px',
                                                    paddingTop: '6px',
                                                    borderTop: `1px solid ${theme.colors.border}`,
                                                    fontSize: '10px',
                                                    color: theme.colors.textSecondary,
                                                }, children: [_jsx(MapPin, { size: 10, style: { display: 'inline', marginRight: '4px' } }), "Applies to ", applicableFiles.length, " files in session"] }));
                                        }
                                        return null;
                                    })()] }, note.id))) })] }, depth)))) : (searchFilteredNotes.map((note) => {
                    const isSelected = selectedNoteIds.has(note.id);
                    return (_jsxs("div", { style: {
                            backgroundColor: isSelected ? theme.colors.primary + '11' : theme.colors.backgroundLight,
                            borderRadius: '8px',
                            padding: '12px',
                            border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                            transition: 'all 0.2s',
                            cursor: onNoteToggle ? 'pointer' : 'default',
                            position: 'relative',
                        }, onClick: () => onNoteToggle?.(note.id), onMouseEnter: (e) => {
                            if (!isSelected) {
                                e.currentTarget.style.borderColor = theme.colors.primary + '66';
                            }
                        }, onMouseLeave: (e) => {
                            if (!isSelected) {
                                e.currentTarget.style.borderColor = theme.colors.border;
                            }
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    marginBottom: '8px',
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [isSelected && (_jsx(CheckCircle2, { size: 14, color: theme.colors.primary })), _jsx(FolderTree, { size: 14, color: theme.colors.primary }), _jsx("span", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.primary,
                                                    fontFamily: 'monospace'
                                                }, children: note.relativePath || '/' }), note.relevance && note.relevance !== 'none' && (_jsx("span", { style: {
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    backgroundColor: note.relevance === 'exact'
                                                        ? theme.colors.success + '22'
                                                        : theme.colors.warning + '22',
                                                    color: note.relevance === 'exact'
                                                        ? theme.colors.success
                                                        : theme.colors.warning,
                                                }, children: note.relevance === 'exact' ? 'EXACT' : `PARENT (${note.pathDistance} levels)` }))] }), _jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary
                                        }, children: [_jsx(Clock, { size: 12 }), new Date(note.timestamp).toLocaleDateString()] })] }), _jsx("p", { style: {
                                    fontSize: '13px',
                                    color: theme.colors.text,
                                    margin: 0,
                                    lineHeight: '1.5'
                                }, children: note.note }), note.metadata && Object.keys(note.metadata).length > 0 && (_jsx("div", { style: {
                                    marginTop: '8px',
                                    paddingTop: '8px',
                                    borderTop: `1px solid ${theme.colors.border}`,
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary
                                }, children: Object.entries(note.metadata).map(([key, value]) => (_jsxs("span", { style: { marginRight: '12px' }, children: [_jsxs("strong", { children: [key, ":"] }), " ", String(value)] }, key))) }))] }, note.id));
                })) }), onNoteToggle && searchFilteredNotes.length > 0 && (_jsx("div", { style: {
                    padding: '12px',
                    borderTop: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    justifyContent: 'center',
                }, children: _jsx("button", { onClick: () => {
                        // Toggle all search filtered notes
                        if (selectedNoteIds.size === searchFilteredNotes.length) {
                            // Clear all
                            searchFilteredNotes.forEach(note => onNoteToggle(note.id));
                        }
                        else {
                            // Select all filtered
                            searchFilteredNotes.forEach(note => {
                                if (!selectedNoteIds.has(note.id)) {
                                    onNoteToggle(note.id);
                                }
                            });
                        }
                    }, style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: selectedNoteIds.size === searchFilteredNotes.length
                            ? theme.colors.primary
                            : theme.colors.backgroundTertiary,
                        color: selectedNoteIds.size === searchFilteredNotes.length
                            ? 'white'
                            : theme.colors.text,
                        border: `1px solid ${selectedNoteIds.size === searchFilteredNotes.length
                            ? theme.colors.primary
                            : theme.colors.border}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                    }, children: selectedNoteIds.size === searchFilteredNotes.length ? (_jsxs(_Fragment, { children: [_jsx(EyeOff, { size: 14 }), "Hide Map Coverage"] })) : (_jsxs(_Fragment, { children: [_jsx(Eye, { size: 14 }), "Show Map Coverage"] })) }) }))] }));
};
