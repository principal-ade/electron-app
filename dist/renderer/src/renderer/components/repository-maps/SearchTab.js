import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTheme } from 'themed-markdown';
import { Code, Check, AlertCircle } from 'lucide-react';
import { LocalSearchPanel } from '../shared/LocalSearchPanel';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { EDITOR_LABELS, DEFAULT_EDITOR } from '../../../shared/types/editor.types';
import { localSearchService } from '../../services/LocalSearchService';
export const SearchTab = ({ fileTrees, activeFileTreeSource, contentProvider, showEditorSelector = true, onFileSelect, selectedFile, onSearchResultsChange, onSearchResultHover, }) => {
    const { theme } = useTheme();
    const [selectedTreeId, setSelectedTreeId] = useState(null);
    const [defaultEditor, setDefaultEditor] = useState(DEFAULT_EDITOR);
    const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
    const editorMenuRef = useRef(null);
    const editorButtonRef = useRef(null);
    const [showContentWarning, setShowContentWarning] = useState(false);
    // Set content provider when it changes
    useEffect(() => {
        if (contentProvider) {
            localSearchService.setContentProvider(contentProvider);
        }
    }, [contentProvider]);
    // Get the first available tree ID as default
    useEffect(() => {
        if (!selectedTreeId && fileTrees.size > 0) {
            const firstTreeId = Array.from(fileTrees.keys())[0];
            setSelectedTreeId(firstTreeId);
        }
    }, [fileTrees, selectedTreeId]);
    // Load saved default editor
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const prefs = await UserPreferencesService.getPreferences();
                const editor = (prefs.defaultEditor ?? DEFAULT_EDITOR);
                if (isMounted)
                    setDefaultEditor(editor);
            }
            catch {
                if (isMounted)
                    setDefaultEditor(DEFAULT_EDITOR);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);
    // Close editor menu on outside click or escape
    useEffect(() => {
        if (!isEditorMenuOpen)
            return;
        const handleClick = (e) => {
            const target = e.target;
            const clickedOutside = editorMenuRef.current && !editorMenuRef.current.contains(target) &&
                editorButtonRef.current && !editorButtonRef.current.contains(target);
            if (clickedOutside)
                setIsEditorMenuOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape')
                setIsEditorMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [isEditorMenuOpen]);
    // Get the selected file tree
    const selectedFileTree = useMemo(() => {
        if (!selectedTreeId)
            return null;
        return fileTrees.get(selectedTreeId);
    }, [fileTrees, selectedTreeId]);
    // Convert FileTree to FileSystemTree format for LocalSearchPanel
    const fileSystemTree = useMemo(() => {
        if (!selectedFileTree)
            return null;
        console.log('[SearchTab] selectedFileTree:', selectedFileTree);
        console.log('[SearchTab] allFiles:', selectedFileTree.allFiles);
        console.log('[SearchTab] allFiles is array:', Array.isArray(selectedFileTree.allFiles));
        // Ensure allFiles and allDirectories are arrays
        const allFiles = Array.isArray(selectedFileTree.allFiles) ? selectedFileTree.allFiles : [];
        const allDirectories = Array.isArray(selectedFileTree.allDirectories) ? selectedFileTree.allDirectories : [];
        // LocalSearchPanel expects a FileSystemTree format
        return {
            sha: selectedFileTree.sha || '',
            root: selectedFileTree.root || { name: 'root', path: '/', relativePath: '/', type: 'directory' },
            allFiles: allFiles,
            allDirectories: allDirectories,
            stats: selectedFileTree.stats || {
                totalFiles: allFiles.length,
                totalDirectories: allDirectories.length,
                totalSize: 0,
                maxDepth: 0,
                buildingTypeDistribution: {}
            },
            // Legacy properties that LocalSearchPanel might use
            files: allFiles,
            directories: {},
        };
    }, [selectedFileTree, activeFileTreeSource]);
    const handleFileSelect = useCallback((filePath, lineNumbers, searchQuery) => {
        console.log('[SearchTab] File selected:', filePath, 'lines:', lineNumbers, 'query:', searchQuery);
        onFileSelect?.(filePath, lineNumbers, searchQuery);
    }, [onFileSelect]);
    const handleOpenInEditor = useCallback(async (filePath) => {
        console.log('[SearchTab] Opening file in editor:', filePath, 'editor:', defaultEditor);
        try {
            // Use the shell API to open the file in the selected editor
            const result = await window.mainProcess?.shell?.openInEditor({
                editor: defaultEditor,
                dir: filePath // Note: current API opens directories, we'll need to update for files
            });
            if (!result?.success) {
                console.error('Failed to open file in editor:', result?.error);
            }
        }
        catch (error) {
            console.error('Error opening file in editor:', error);
        }
    }, [defaultEditor]);
    const handleSearchResultsChange = useCallback((results) => {
        console.log('[SearchTab] Search results received:', results);
        // Convert LocalSearchResult[] to relative paths
        // Use relativePath property which should be relative to the repository root
        const paths = results.map(r => {
            // Use relativePath if available, otherwise try to extract from path
            if (r.relativePath) {
                return r.relativePath;
            }
            // Fallback: if path contains the base directory, extract relative part
            const path = r.path;
            // Remove leading slash if present
            return path.startsWith('/') ? path.slice(1) : path;
        });
        console.log('[SearchTab] Converted to relative paths:', paths);
        onSearchResultsChange?.(paths);
    }, [onSearchResultsChange]);
    if (!fileSystemTree || !activeFileTreeSource) {
        return (_jsx("div", { style: {
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary
            }, children: "No file tree available for search" }));
    }
    return (_jsx("div", { style: { height: '100%', display: 'flex', flexDirection: 'column' }, children: _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(LocalSearchPanel, { fileSystemTree: fileSystemTree, baseDirectory: activeFileTreeSource.location, onFileSelect: handleFileSelect, selectedFile: selectedFile, onOpenInEditor: showEditorSelector ? handleOpenInEditor : undefined, selectedEditor: EDITOR_LABELS[defaultEditor], headerExtra: _jsxs("div", { style: { display: 'flex', gap: '12px', alignItems: 'center' }, children: [contentProvider && !contentProvider.canProvideContent() && (_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                backgroundColor: `${theme.colors.warning || '#f59e0b'}15`,
                                border: `1px solid ${theme.colors.warning || '#f59e0b'}40`,
                                borderRadius: '6px',
                                fontSize: '11px',
                                color: theme.colors.warning || '#f59e0b'
                            }, children: [_jsx(AlertCircle, { size: 12 }), _jsx("span", { children: "File name search only (content search not available)" })] })), fileTrees.size > 1 && (_jsxs("div", { style: { display: 'flex', gap: '8px', alignItems: 'center' }, children: [_jsx("span", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                        fontWeight: 500
                                    }, children: "Search in:" }), Array.from(fileTrees.entries()).map(([id, tree]) => {
                                    const isSelected = id === selectedTreeId;
                                    const label = id.includes('HEAD') ? 'HEAD Commit' : 'Working Directory';
                                    return (_jsx("button", { onClick: () => setSelectedTreeId(id), style: {
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            backgroundColor: isSelected
                                                ? `${theme.colors.primary}22`
                                                : theme.colors.backgroundTertiary,
                                            border: isSelected
                                                ? `1px solid ${theme.colors.primary}`
                                                : `1px solid ${theme.colors.border}`,
                                            color: isSelected
                                                ? theme.colors.primary
                                                : theme.colors.textSecondary,
                                            fontSize: '12px',
                                            fontWeight: isSelected ? 600 : 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }, children: label }, id));
                                })] })), showEditorSelector && (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { ref: editorButtonRef, onClick: () => setIsEditorMenuOpen((v) => !v), style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 10px',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '6px',
                                        color: theme.colors.text,
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                    }, title: "Default editor for opening local files", children: [_jsx(Code, { size: 12 }), EDITOR_LABELS[defaultEditor]] }), isEditorMenuOpen && (_jsxs("div", { ref: editorMenuRef, style: {
                                        position: 'absolute',
                                        right: 0,
                                        top: 'calc(100% + 8px)',
                                        minWidth: '180px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '8px',
                                        boxShadow: theme.shadows?.[0] || '0 2px 8px rgba(0,0,0,0.1)',
                                        padding: '6px',
                                        zIndex: 10,
                                    }, children: [_jsx("div", { style: {
                                                padding: '4px 6px',
                                                fontSize: '11px',
                                                color: theme.colors.textSecondary,
                                                borderBottom: `1px solid ${theme.colors.border}`,
                                                marginBottom: '4px',
                                            }, children: "Open files in" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column' }, children: Object.entries(EDITOR_LABELS).map(([id, label]) => {
                                                const isActive = id === defaultEditor;
                                                return (_jsxs("button", { onClick: async () => {
                                                        const value = id;
                                                        setDefaultEditor(value);
                                                        await UserPreferencesService.updatePreferences({ defaultEditor: value });
                                                        setIsEditorMenuOpen(false);
                                                    }, style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '6px',
                                                        padding: '6px 8px',
                                                        background: isActive ? `${theme.colors.primary}15` : 'transparent',
                                                        color: theme.colors.text,
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        fontSize: '12px',
                                                    }, children: [_jsx("span", { children: label }), isActive && _jsx(Check, { size: 12, color: theme.colors.primary })] }, id));
                                            }) })] }))] }))] }), onSearchResultsChange: handleSearchResultsChange, onSearchResultHover: onSearchResultHover }) }) }));
};
