import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { Search, FileText, FolderOpen, ChevronRight, PenTool, Book } from 'lucide-react';
export const DocumentationPanel = ({ fileTree, onDocumentSelect, selectedDocument }) => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [documents, setDocuments] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set(['docs']));
    const [loading, setLoading] = useState(false);
    // Helper to determine document type
    const getDocumentType = (fileName) => {
        if (fileName.endsWith('.excalidraw') || fileName.endsWith('.excalidraw.json')) {
            return 'excalidraw';
        }
        if (fileName.endsWith('.md') || fileName.endsWith('.MD')) {
            return 'markdown';
        }
        return null;
    };
    // Build a tree structure from flat file list
    const buildDocumentTree = useCallback((files) => {
        const tree = {};
        const rootItems = [];
        // First pass: create all items
        for (const file of files) {
            const type = getDocumentType(file.name);
            if (!type && !file.isDirectory)
                continue;
            const item = {
                path: file.path || file.relativePath,
                name: file.name,
                relativePath: file.relativePath,
                type: type || 'markdown',
                isDirectory: file.isDirectory || file.type === 'directory' || false,
                children: [],
                depth: file.relativePath.split('/').length - 1
            };
            tree[file.relativePath] = item;
        }
        // Second pass: build hierarchy
        for (const relativePath in tree) {
            const item = tree[relativePath];
            const pathParts = relativePath.split('/');
            if (pathParts.length === 1) {
                // Root level item
                rootItems.push(item);
            }
            else {
                // Find parent
                const parentPath = pathParts.slice(0, -1).join('/');
                const parent = tree[parentPath];
                if (parent && parent.children) {
                    parent.children.push(item);
                }
                else {
                    // Orphaned item, add to root
                    rootItems.push(item);
                }
            }
        }
        // Sort items: directories first, then alphabetically by relative path
        const sortItems = (items) => {
            items.sort((a, b) => {
                // Directories come first
                if (a.isDirectory && !b.isDirectory)
                    return -1;
                if (!a.isDirectory && b.isDirectory)
                    return 1;
                // Then sort alphabetically by relative path
                return a.relativePath.toLowerCase().localeCompare(b.relativePath.toLowerCase());
            });
            // Recursively sort children
            items.forEach(item => {
                if (item.children && item.children.length > 0) {
                    sortItems(item.children);
                }
            });
        };
        sortItems(rootItems);
        return rootItems;
    }, []);
    // Search for documents in docs/ directory
    useEffect(() => {
        if (!fileTree) {
            setDocuments([]);
            return;
        }
        setLoading(true);
        try {
            // Debug: log some sample files to see the structure
            console.info('[DocumentationPanel] Sample files from fileTree:', fileTree.allFiles.slice(0, 5));
            console.info('[DocumentationPanel] Total files in tree:', fileTree.allFiles.length);
            // Check if there are any directories
            if (fileTree.allDirectories) {
                console.info('[DocumentationPanel] Sample directories:', fileTree.allDirectories.slice(0, 5));
                const docsDir = fileTree.allDirectories.find(dir => dir.relativePath === 'docs' || dir.name === 'docs');
                console.info('[DocumentationPanel] Found docs directory:', docsDir);
            }
            // Combine files and directories for docs/
            const allItems = [];
            // Add directories in docs/ (excluding .a24z)
            if (fileTree.allDirectories) {
                const docsDirs = fileTree.allDirectories.filter(dir => {
                    // Exclude .a24z directories
                    if (dir.relativePath.includes('.a24z'))
                        return false;
                    return dir.relativePath === 'docs' || dir.relativePath.startsWith('docs/');
                });
                allItems.push(...docsDirs.map(dir => ({
                    ...dir,
                    isDirectory: true,
                    type: 'directory'
                })));
            }
            // Add files in docs/ (excluding .a24z)
            const docsFiles = fileTree.allFiles.filter(file => {
                // Exclude files in .a24z directories
                if (file.relativePath.includes('.a24z'))
                    return false;
                // Check if file is in docs/ directory
                const isInDocs = file.relativePath.startsWith('docs/');
                if (!isInDocs)
                    return false;
                // Only include markdown and excalidraw files
                return file.name.endsWith('.md') ||
                    file.name.endsWith('.MD') ||
                    file.name.endsWith('.excalidraw') ||
                    file.name.endsWith('.excalidraw.json');
            });
            allItems.push(...docsFiles);
            console.info('[DocumentationPanel] Found docs items:', allItems.length, allItems);
            // Only show documents if docs folder exists
            if (allItems.length === 0) {
                console.info('[DocumentationPanel] No docs/ directory found');
                setDocuments([]);
            }
            else {
                // Build tree structure from docs items
                const tree = buildDocumentTree(allItems);
                setDocuments(tree);
                // Auto-expand docs folder if it exists
                const docsFolder = tree.find(item => item.name === 'docs' && item.isDirectory);
                if (docsFolder) {
                    setExpandedFolders(new Set(['docs']));
                }
            }
        }
        catch (err) {
            console.error('Failed to load documentation:', err);
        }
        finally {
            setLoading(false);
        }
    }, [fileTree, buildDocumentTree]);
    // Filter documents based on search
    const filterDocuments = useCallback((items, query) => {
        if (!query)
            return items;
        const lowerQuery = query.toLowerCase();
        const filtered = [];
        for (const item of items) {
            const nameMatch = item.name.toLowerCase().includes(lowerQuery);
            const pathMatch = item.relativePath.toLowerCase().includes(lowerQuery);
            if (item.isDirectory && item.children) {
                const filteredChildren = filterDocuments(item.children, query);
                if (filteredChildren.length > 0) {
                    filtered.push({
                        ...item,
                        children: filteredChildren
                    });
                    // Auto-expand folders with matches
                    setExpandedFolders(prev => new Set([...prev, item.relativePath]));
                }
            }
            else if (nameMatch || pathMatch) {
                filtered.push(item);
            }
        }
        return filtered;
    }, []);
    const filteredDocuments = useMemo(() => {
        return filterDocuments(documents, searchQuery);
    }, [documents, searchQuery, filterDocuments]);
    // Toggle folder expansion
    const toggleFolder = (folderPath) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderPath)) {
                newSet.delete(folderPath);
            }
            else {
                newSet.add(folderPath);
            }
            return newSet;
        });
    };
    // Render a document item (recursive for tree structure)
    const renderDocumentItem = (item, depth = 0) => {
        const isSelected = item.path === selectedDocument || item.relativePath === selectedDocument;
        const isExpanded = expandedFolders.has(item.relativePath);
        return (_jsxs("div", { children: [_jsx("div", { onClick: () => {
                        if (item.isDirectory) {
                            toggleFolder(item.relativePath);
                        }
                        else {
                            onDocumentSelect(item.path, item.type);
                        }
                    }, style: {
                        padding: '8px',
                        paddingLeft: item.isDirectory ? `${8 + depth * 16}px` : `${20 + depth * 16}px`,
                        marginBottom: '4px',
                        backgroundColor: isSelected ? `${theme.colors.primary}15` : 'transparent',
                        border: isSelected ? `1px solid ${theme.colors.primary}` : '1px solid transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }, onMouseEnter: (e) => {
                        if (!isSelected) {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }
                    }, onMouseLeave: (e) => {
                        if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }
                    }, children: item.isDirectory ? (
                    // Directory row
                    _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }, children: [_jsx(ChevronRight, { size: 12, style: {
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s ease',
                                    color: theme.colors.textSecondary
                                } }), _jsx(FolderOpen, { size: 14, color: theme.colors.textSecondary }), _jsx("span", { style: {
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: theme.colors.text
                                }, children: item.name })] })) : (
                    // File row with name and path
                    _jsxs("div", { children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px'
                                }, children: [item.type === 'excalidraw' ? (_jsx(PenTool, { size: 14, color: isSelected ? theme.colors.primary : theme.colors.textSecondary })) : (_jsx(FileText, { size: 14, color: isSelected ? theme.colors.primary : theme.colors.textSecondary })), _jsx("span", { style: {
                                            fontSize: '13px',
                                            fontWeight: isSelected ? 600 : 500,
                                            color: isSelected ? theme.colors.primary : theme.colors.text,
                                            flex: 1,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }, children: item.name }), _jsx(ChevronRight, { size: 12, color: theme.colors.textSecondary })] }), _jsx("div", { style: {
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary,
                                    marginLeft: '22px'
                                }, children: item.relativePath })] })) }), item.isDirectory && isExpanded && item.children && item.children.length > 0 && (_jsx("div", { children: item.children.map(child => renderDocumentItem(child, depth + 1)) }))] }, item.relativePath));
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            overflow: 'hidden'
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
                                }, children: [_jsx(Book, { size: 16 }), _jsx("span", { style: {
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: theme.colors.text
                                        }, children: "Documentation" })] }), _jsx("span", { style: {
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary,
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 500
                                }, children: "docs/" })] }), _jsxs("div", { style: { position: 'relative' }, children: [_jsx(Search, { size: 14, style: {
                                    position: 'absolute',
                                    left: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: theme.colors.textSecondary
                                } }), _jsx("input", { type: "text", placeholder: "Search documentation...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
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
                    padding: '8px'
                }, children: loading ? (_jsx("div", { style: {
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        padding: '20px',
                        fontSize: '12px'
                    }, children: "Loading documentation..." })) : filteredDocuments.length === 0 ? (_jsxs("div", { style: {
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        padding: '40px 20px',
                        fontSize: '12px'
                    }, children: [_jsx("div", { style: { marginBottom: '8px', opacity: 0.5 }, children: _jsx(Book, { size: 32 }) }), _jsx("div", { style: { marginBottom: '4px' }, children: searchQuery ? `No documents found matching "${searchQuery}"` : 'No documentation found' }), _jsx("div", { style: { fontSize: '11px', opacity: 0.8 }, children: !searchQuery && 'Create markdown or excalidraw files in the docs/ directory' })] })) : (filteredDocuments.map(item => renderDocumentItem(item))) })] }));
};
