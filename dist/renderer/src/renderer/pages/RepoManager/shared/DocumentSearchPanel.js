import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTheme } from 'themed-markdown';
import { Search, FileText, Clock, ChevronRight, Trash2, PenTool } from 'lucide-react';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
export const DocumentSearchPanel = ({ baseDirectory, fileTree, onDocumentSelect, onDocumentDeleted, selectedDocument }) => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [documents, setDocuments] = useState([]);
    const [recentDocuments, setRecentDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [deletingDoc, setDeletingDoc] = useState(null);
    const [deletedDocs, setDeletedDocs] = useState(new Set());
    const [showUndoNotification, setShowUndoNotification] = useState(false);
    const [lastDeletedDoc, setLastDeletedDoc] = useState(null);
    const isOptimisticDelete = useRef(false);
    // Helper to determine document type
    const getDocumentType = (fileName) => {
        if (fileName.endsWith('.excalidraw') || fileName.endsWith('.excalidraw.json')) {
            return 'excalidraw';
        }
        return 'markdown';
    };
    // Search for documents in both repository and app data
    const searchDocuments = useCallback(async (query = '') => {
        setLoading(true);
        setError(null);
        try {
            const docs = [];
            // 1. Search repository files (markdown and excalidraw)
            if (fileTree) {
                // Filter markdown and excalidraw files from the FileTree
                const supportedFiles = fileTree.allFiles.filter(file => file.name.endsWith('.md') ||
                    file.name.endsWith('.MD') ||
                    file.name.endsWith('.excalidraw') ||
                    file.name.endsWith('.excalidraw.json'));
                for (const file of supportedFiles) {
                    // Build the full path
                    const fullPath = file.path.startsWith('/')
                        ? file.path
                        : `${baseDirectory}/${file.path}`.replace(/\/+/g, '/');
                    const docType = getDocumentType(file.name);
                    // Check if it matches the search query
                    const nameMatch = !query ||
                        file.name.toLowerCase().includes(query.toLowerCase()) ||
                        file.relativePath.toLowerCase().includes(query.toLowerCase());
                    if (nameMatch) {
                        try {
                            // Try to get file stats
                            const stats = await FileSystemService.getFileStats(fullPath);
                            // Try to get a preview (only for markdown)
                            let preview = '';
                            if (docType === 'markdown') {
                                try {
                                    const result = await FileSystemService.readFile(fullPath);
                                    if (result && result.content) {
                                        const content = result.content;
                                        const lines = content.split('\n');
                                        const previewLine = lines.find(line => line.trim() && !line.startsWith('#') && !line.startsWith('---'));
                                        preview = previewLine?.trim().substring(0, 100) || '';
                                        // Also check content for search query if name didn't match
                                        if (query && !nameMatch) {
                                            const contentMatch = content.toLowerCase().includes(query.toLowerCase());
                                            if (!contentMatch)
                                                continue;
                                        }
                                    }
                                }
                                catch (_err) {
                                    // Ignore preview errors
                                }
                            }
                            docs.push({
                                path: fullPath,
                                name: file.name.replace(/\.(md|excalidraw|excalidraw\.json)$/i, ''),
                                relativePath: file.relativePath,
                                lastModified: new Date(stats?.mtime || Date.now()),
                                preview,
                                type: docType,
                                storageLocation: 'repository'
                            });
                        }
                        catch (_err) {
                            // If we can't get stats, still include the file with current date
                            docs.push({
                                path: fullPath,
                                name: file.name.replace(/\.(md|excalidraw|excalidraw\.json)$/i, ''),
                                relativePath: file.relativePath,
                                lastModified: new Date(),
                                preview: '',
                                type: docType,
                                storageLocation: 'repository'
                            });
                        }
                    }
                }
            }
            // Sort by last modified date
            docs.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
            setDocuments(docs);
            // Set recent documents (top 5 repository documents)
            if (!query) {
                setRecentDocuments(docs.slice(0, 5));
            }
        }
        catch (err) {
            console.error('Failed to search documents:', err);
            setError('Failed to search for documents');
        }
        finally {
            setLoading(false);
        }
    }, [fileTree, baseDirectory]);
    // Initial load and reload when fileTree changes
    useEffect(() => {
        // Skip search if we're doing an optimistic delete
        if (!isOptimisticDelete.current) {
            console.info('[DocumentSearchPanel] FileTree changed, searching documents');
            searchDocuments(searchQuery);
        }
        else {
            console.info('[DocumentSearchPanel] FileTree changed but skipping search due to optimistic delete');
        }
    }, [fileTree]); // Re-search when fileTree changes
    // Debounced search for query changes
    useEffect(() => {
        const timer = setTimeout(() => {
            searchDocuments(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchDocuments]);
    // Filter documents based on search
    const filteredDocuments = useMemo(() => {
        if (!searchQuery)
            return [];
        const query = searchQuery.toLowerCase();
        return documents.filter(doc => doc.name.toLowerCase().includes(query) ||
            doc.relativePath.toLowerCase().includes(query) ||
            (doc.preview && doc.preview.toLowerCase().includes(query)));
    }, [documents, searchQuery]);
    const formatDate = (date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0)
            return 'Today';
        if (days === 1)
            return 'Yesterday';
        if (days < 7)
            return `${days} days ago`;
        if (days < 30)
            return `${Math.floor(days / 7)} weeks ago`;
        return date.toLocaleDateString();
    };
    // Delete a document with smooth animation and optimistic updates
    const deleteDocument = async (doc) => {
        if (deletingDoc)
            return;
        const storageInfo = doc.storageLocation === 'app-data'
            ? ' from app data storage'
            : ' from the repository';
        const confirmed = window.confirm(`Delete "${doc.name}"${storageInfo}?\n\n${doc.storageLocation === 'repository'
            ? 'This will move the file to trash.'
            : 'This will permanently delete the diagram from app storage.'}`);
        if (!confirmed)
            return;
        const docId = doc.diagramId || doc.path;
        // Set flag to prevent file tree changes from triggering search
        console.info('[DocumentSearchPanel] Setting optimistic delete flag for:', doc.name);
        isOptimisticDelete.current = true;
        // Start deletion animation
        setDeletingDoc(docId);
        // Store the original lists in case we need to restore
        const originalDocuments = documents;
        const originalRecent = recentDocuments;
        // Start fade-out animation immediately
        setDeletedDocs(prev => new Set(prev).add(docId));
        // After animation completes, remove from lists and perform deletion
        setTimeout(async () => {
            // Batch all state updates together to minimize re-renders
            // Remove from lists and clean up deleted set in one go
            setDocuments(prev => prev.filter(d => (d.diagramId || d.path) !== docId));
            setRecentDocuments(prev => prev.filter(d => (d.diagramId || d.path) !== docId));
            setDeletedDocs(prev => {
                const newSet = new Set(prev);
                newSet.delete(docId);
                return newSet;
            });
            // Show undo notification
            setShowUndoNotification(true);
            // Set up auto-hide for notification
            const timeout = setTimeout(() => {
                setShowUndoNotification(false);
                setLastDeletedDoc(null);
            }, 5000);
            // Store doc and timeout for undo
            setLastDeletedDoc({ doc, timeout });
            try {
                // Perform the actual deletion
                if (doc.path) {
                    // Delete from file system
                    const result = await window.mainProcess?.shell?.moveToTrash(doc.path);
                    if (result?.success === false) {
                        throw new Error(result.error || 'Failed to move file to trash');
                    }
                    console.info('[DocumentSearchPanel] Moved document to trash:', doc.path);
                    // Notify parent component (but don't reload state)
                    onDocumentDeleted?.(doc.path);
                }
                // Success - animation state already cleaned up above
                // Reset the flag after a longer delay to ensure all file tree updates are complete
                setTimeout(() => {
                    console.info('[DocumentSearchPanel] Resetting optimistic delete flag');
                    isOptimisticDelete.current = false;
                }, 500);
            }
            catch (_err) {
                console.error('[DocumentSearchPanel] Failed to delete document:', err);
                // Reset the flag on error
                isOptimisticDelete.current = false;
                // Restore the document on error
                setDeletedDocs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(docId);
                    return newSet;
                });
                // Restore original lists
                setDocuments(originalDocuments);
                setAppStorageDocuments(originalAppStorage);
                setRecentDocuments(originalRecent);
                // Hide undo notification
                setShowUndoNotification(false);
                if (lastDeletedDoc?.timeout) {
                    clearTimeout(lastDeletedDoc.timeout);
                }
                setLastDeletedDoc(null);
                alert('Failed to delete document');
            }
            finally {
                setDeletingDoc(null);
            }
        }, 300); // Wait for fade animation
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative'
        }, children: [_jsxs("div", { style: {
                    padding: '12px 16px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px'
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }, children: [_jsx(FileText, { size: 16 }), _jsx("span", { style: {
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: theme.colors.text
                                        }, children: "Planning Documents" })] }), _jsxs("span", { style: {
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary,
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 500
                                }, children: [documents.length, " ", documents.length === 1 ? 'document' : 'documents'] })] }), _jsxs("div", { style: {
                            position: 'relative',
                            marginBottom: '12px'
                        }, children: [_jsx(Search, { size: 14, style: {
                                    position: 'absolute',
                                    left: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: theme.colors.textSecondary
                                } }), _jsx("input", { type: "text", placeholder: "Search all documents...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
                                    width: '100%',
                                    padding: '6px 10px 6px 32px',
                                    backgroundColor: theme.colors.background,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: theme.colors.text,
                                    outline: 'none'
                                }, onFocus: (e) => {
                                    e.target.style.borderColor = theme.colors.primary;
                                }, onBlur: (e) => {
                                    e.target.style.borderColor = theme.colors.border;
                                } })] })] }), _jsx("div", { style: {
                    flex: 1,
                    overflow: 'auto',
                    padding: '12px'
                }, children: loading ? (_jsx("div", { style: {
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        padding: '20px'
                    }, children: "Searching for documents..." })) : error ? (_jsx("div", { style: {
                        textAlign: 'center',
                        color: theme.colors.error,
                        padding: '20px'
                    }, children: error })) : (_jsxs(_Fragment, { children: [!searchQuery && recentDocuments.length > 0 && (_jsxs("div", { style: { marginBottom: '20px' }, children: [_jsxs("div", { style: {
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: theme.colors.textSecondary,
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }, children: [_jsx(Clock, { size: 11 }), "RECENT"] }), recentDocuments.map(doc => (_jsx(DocumentItem, { document: doc, isSelected: doc.path === selectedDocument || doc.diagramId === selectedDocument, onClick: () => onDocumentSelect(doc.path, doc.type, doc.storageLocation, doc.diagramId), onDelete: () => deleteDocument(doc), isDeleting: deletingDoc === (doc.diagramId || doc.path), isDeleted: deletedDocs.has(doc.diagramId || doc.path), theme: theme, formatDate: formatDate }, doc.diagramId || doc.path)))] })), searchQuery && (_jsxs("div", { children: [_jsxs("div", { style: {
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: theme.colors.textSecondary,
                                        marginBottom: '8px'
                                    }, children: ["SEARCH RESULTS (", filteredDocuments.length, ")"] }), filteredDocuments.length === 0 ? (_jsxs("div", { style: {
                                        textAlign: 'center',
                                        color: theme.colors.textSecondary,
                                        padding: '20px',
                                        fontSize: '12px'
                                    }, children: ["No documents found matching \"", searchQuery, "\""] })) : (filteredDocuments.map(doc => (_jsx(DocumentItem, { document: doc, isSelected: doc.path === selectedDocument || doc.diagramId === selectedDocument, onClick: () => onDocumentSelect(doc.path, doc.type, doc.storageLocation, doc.diagramId), onDelete: () => deleteDocument(doc), isDeleting: deletingDoc === (doc.diagramId || doc.path), theme: theme, formatDate: formatDate }, doc.diagramId || doc.path))))] })), !searchQuery && recentDocuments.length === 0 && (_jsxs("div", { style: {
                                textAlign: 'center',
                                color: theme.colors.textSecondary,
                                padding: '40px 20px',
                                fontSize: '12px'
                            }, children: [_jsx("div", { style: { marginBottom: '8px', opacity: 0.5 }, children: _jsx(FileText, { size: 32 }) }), _jsx("div", { style: { marginBottom: '4px' }, children: "No documents yet" }), _jsx("div", { style: { fontSize: '11px', opacity: 0.8 }, children: "Click \"Start Planning\" to create your first document" })] }))] })) }), showUndoNotification && lastDeletedDoc && (_jsxs("div", { style: {
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: `translateX(-50%) translateY(${showUndoNotification ? '0' : '100px'})`,
                    backgroundColor: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    transition: 'transform 0.3s ease-out',
                    zIndex: 100
                }, children: [_jsxs("span", { style: {
                            fontSize: '12px',
                            color: theme.colors.text
                        }, children: ["Deleted \"", lastDeletedDoc.doc.name, "\""] }), _jsx("button", { onClick: async () => {
                            // Clear timeout
                            if (lastDeletedDoc.timeout) {
                                clearTimeout(lastDeletedDoc.timeout);
                            }
                            // Hide notification
                            setShowUndoNotification(false);
                            // Note: Actual undo would require storing the file content
                            // For now, just inform the user
                            alert('To restore the file, check your system trash/recycle bin');
                            setLastDeletedDoc(null);
                        }, style: {
                            padding: '4px 8px',
                            backgroundColor: theme.colors.primary,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.opacity = '0.9';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.opacity = '1';
                        }, children: "UNDO" })] }))] }));
};
// Document Item Component
const DocumentItem = ({ document, isSelected, onClick, onDelete, isDeleting, isDeleted, theme, formatDate }) => {
    return (_jsxs("div", { onClick: onClick, style: {
            padding: '8px',
            marginBottom: '4px',
            backgroundColor: isSelected ? `${theme.colors.primary}15` : 'transparent',
            border: isSelected ? `1px solid ${theme.colors.primary}` : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.3s ease-out',
            opacity: isDeleted ? 0 : isDeleting ? 0.5 : 1,
            transform: isDeleted ? 'translateX(-20px) scale(0.95)' : 'translateX(0) scale(1)',
            pointerEvents: isDeleting || isDeleted ? 'none' : 'auto'
        }, onMouseEnter: (e) => {
            if (!isSelected && !isDeleting && !isDeleted) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }
        }, onMouseLeave: (e) => {
            if (!isSelected && !isDeleting && !isDeleted) {
                e.currentTarget.style.backgroundColor = 'transparent';
            }
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                }, children: [_jsxs("div", { style: { position: 'relative' }, children: [document.type === 'excalidraw' ? (_jsx(PenTool, { size: 14, color: isSelected ? theme.colors.primary : theme.colors.textSecondary })) : (_jsx(FileText, { size: 14, color: isSelected ? theme.colors.primary : theme.colors.textSecondary })), document.storageLocation === 'app-data' && (_jsx(Database, { size: 8, color: theme.colors.primary, style: {
                                    position: 'absolute',
                                    bottom: -2,
                                    right: -2,
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '2px',
                                    padding: '1px'
                                } }))] }), _jsx("span", { style: {
                            fontSize: '13px',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? theme.colors.primary : theme.colors.text,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            opacity: isDeleting ? 0.5 : 1
                        }, children: document.name }), _jsx("button", { onClick: (e) => {
                            e.stopPropagation();
                            onDelete();
                        }, disabled: isDeleting, style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: isDeleting ? 'wait' : 'pointer',
                            color: theme.colors.textSecondary,
                            padding: 0,
                            opacity: isDeleting ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }, onMouseEnter: (e) => {
                            if (!isDeleting) {
                                e.currentTarget.style.backgroundColor = theme.colors.error;
                                e.currentTarget.style.color = '#fff';
                            }
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = theme.colors.textSecondary;
                        }, title: "Delete document", children: _jsx(Trash2, { size: 12 }) }), _jsx(ChevronRight, { size: 12, color: theme.colors.textSecondary })] }), _jsxs("div", { style: {
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginLeft: '22px'
                }, children: [_jsx("div", { style: { marginBottom: '2px' }, children: document.relativePath }), _jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }, children: [_jsx("span", { children: formatDate(document.lastModified) }), document.preview && (_jsx("span", { style: {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '200px',
                                    opacity: 0.7
                                }, children: document.preview }))] })] })] }));
};
