import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { validateCodebaseViewConfig, autoFixGridConfig, } from '../../builder/GridLayoutConfigValidator';
import { GridPositioner } from './GridPositioner';
import { GroupNaming } from './GroupNaming';
import { GroupSelector } from './GroupSelector';
import { GroupsList } from './GroupsList';
export const CityConfigBuilder = ({ fileSystemTree, onConfigGenerated, onGroupsChange, theme, showGridLines: _showGridLines = true, initialGroups = [], initialGridSize = { rows: 1, cols: 1 }, }) => {
    const [gridSize, setGridSize] = useState(initialGridSize);
    const [groups, setGroups] = useState(initialGroups);
    const [currentGroup, setCurrentGroup] = useState(null);
    const [selectedDirectories, setSelectedDirectories] = useState(new Set());
    const [workflowStep, setWorkflowStep] = useState('idle');
    const [editingGroup, setEditingGroup] = useState(null);
    const defaultTheme = {
        colors: {
            primary: '#667eea',
            text: '#1f2937',
            textSecondary: '#6b7280',
            background: '#ffffff',
            backgroundSecondary: '#f9fafb',
            border: '#e5e7eb',
        },
        radius: {
            sm: '4px',
            md: '6px',
            lg: '8px',
        },
        components: {
            button: {
                primary: {
                    backgroundColor: '#667eea',
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                },
                secondary: {
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                },
            },
        },
    };
    const t = theme || defaultTheme;
    // Get grouped items
    const getGroupedItems = () => {
        const grouped = new Set();
        groups.forEach(group => {
            group.files.forEach(file => grouped.add(file));
        });
        return grouped;
    };
    // Helper function to recursively get all file paths from a directory
    const getAllFilesFromDirectory = (dir, basePath = '') => {
        const files = [];
        const currentPath = basePath ? `${basePath}/${dir.name}` : dir.name;
        if (dir.children) {
            for (const child of dir.children) {
                if ('children' in child) {
                    // It's a directory, recurse
                    files.push(...getAllFilesFromDirectory(child, currentPath));
                }
                else {
                    // It's a file
                    files.push(`${currentPath}/${child.name}`);
                }
            }
        }
        return files;
    };
    // Get root level items
    const getRootItems = () => {
        if (!fileSystemTree?.root?.children)
            return [];
        const groupedItems = getGroupedItems();
        const items = fileSystemTree.root.children.map((child) => ({
            name: child.name,
            path: child.relativePath || child.name,
            type: 'children' in child ? 'directory' : 'file',
            size: 'size' in child ? child.size : 'fileCount' in child ? child.fileCount : 0,
            isGrouped: groupedItems.has(child.relativePath || child.name),
        }));
        return items.sort((a, b) => {
            if (!a.isGrouped && b.isGrouped)
                return -1;
            if (a.isGrouped && !b.isGrouped)
                return 1;
            if (a.type === 'directory' && b.type === 'file')
                return -1;
            if (a.type === 'file' && b.type === 'directory')
                return 1;
            return b.size - a.size;
        });
    };
    // Generate configuration
    const generateConfig = () => {
        const config = {
            id: `config-${Date.now()}`,
            version: '1.0.0',
            name: 'Generated Codebase View',
            description: 'Automatically generated codebase view configuration',
            overviewPath: 'README.md', // Default overview path
            cells: {},
            metadata: {
                ui: {
                    enabled: groups.length > 0 || gridSize.rows > 1 || gridSize.cols > 1,
                    rows: gridSize.rows,
                    cols: gridSize.cols,
                    cellPadding: 10,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                    cellLabelHeightPercent: 0.1,
                },
            },
        };
        groups.forEach((group, index) => {
            if (group.position) {
                config.cells[group.name] = {
                    files: group.files,
                    coordinates: [group.position.row - 1, group.position.col - 1],
                    priority: groups.length - index,
                    metadata: {
                        ui: {
                            color: group.color,
                        },
                    },
                };
            }
        });
        return config;
    };
    // Get a color for the group
    const getGroupColor = (index) => {
        const colors = ['#667eea', '#f56565', '#48bb78', '#ed8936', '#9f7aea', '#38b2ac'];
        return colors[index % colors.length];
    };
    // Start creating a new group
    const startNewGroup = () => {
        setWorkflowStep('selecting');
        setCurrentGroup({ name: '', files: [] });
        setSelectedDirectories(new Set());
    };
    // Place group at position
    const placeGroupAtPosition = (row, col) => {
        if (!currentGroup || currentGroup.files.length === 0)
            return;
        const newRows = Math.max(gridSize.rows, row);
        const newCols = Math.max(gridSize.cols, col);
        setGridSize({ rows: newRows, cols: newCols });
        const newGroup = {
            id: `group-${Date.now()}`,
            name: currentGroup.name || `Group ${groups.length + 1}`,
            files: currentGroup.files,
            position: { row, col },
            color: getGroupColor(groups.length),
        };
        const updatedGroups = [...groups, newGroup];
        setGroups(updatedGroups);
        if (onGroupsChange) {
            onGroupsChange(updatedGroups);
        }
        setCurrentGroup(null);
        setSelectedDirectories(new Set());
        setWorkflowStep('idle');
    };
    // Update an existing group
    const updateGroup = (row, col) => {
        if (!editingGroup || !currentGroup)
            return;
        const newRows = Math.max(gridSize.rows, row);
        const newCols = Math.max(gridSize.cols, col);
        setGridSize({ rows: newRows, cols: newCols });
        const updatedGroups = groups.map(g => g.id === editingGroup
            ? {
                ...g,
                name: currentGroup.name || g.name,
                files: currentGroup.files,
                position: { row, col },
            }
            : g);
        setGroups(updatedGroups);
        if (onGroupsChange) {
            onGroupsChange(updatedGroups);
        }
        setEditingGroup(null);
        setCurrentGroup(null);
        setSelectedDirectories(new Set());
        setWorkflowStep('idle');
    };
    // Start editing a group
    const startEditingGroup = (groupId) => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
            setEditingGroup(groupId);
            setWorkflowStep('editing');
            setCurrentGroup({ name: group.name, files: group.files });
            setSelectedDirectories(new Set(group.files));
        }
    };
    // Delete a group
    const deleteGroup = (groupId) => {
        const updatedGroups = groups.filter(g => g.id !== groupId);
        setGroups(updatedGroups);
        if (onGroupsChange) {
            onGroupsChange(updatedGroups);
        }
        if (editingGroup === groupId) {
            setEditingGroup(null);
            setWorkflowStep('idle');
            setCurrentGroup(null);
            setSelectedDirectories(new Set());
        }
    };
    // Handle item selection
    const toggleItemSelection = (path) => {
        // Find the item in the file tree to determine if it's a directory
        const findItem = (node, searchPath) => {
            if (node.relativePath === searchPath || node.name === searchPath) {
                return node;
            }
            if ('children' in node && node.children) {
                for (const child of node.children) {
                    const found = findItem(child, searchPath);
                    if (found)
                        return found;
                }
            }
            return null;
        };
        const item = fileSystemTree?.root ? findItem(fileSystemTree.root, path) : null;
        let filesToToggle = [];
        if (item && 'children' in item) {
            // It's a directory - expand to all files within
            filesToToggle = getAllFilesFromDirectory(item);
        }
        else {
            // It's a file - just add the file path
            filesToToggle = [path];
        }
        const newSelected = new Set(selectedDirectories);
        // Check if we should add or remove
        // If any of the files are already selected, remove all; otherwise add all
        const shouldRemove = filesToToggle.some(file => newSelected.has(file));
        if (shouldRemove) {
            filesToToggle.forEach(file => newSelected.delete(file));
        }
        else {
            filesToToggle.forEach(file => newSelected.add(file));
        }
        setSelectedDirectories(newSelected);
        if (currentGroup) {
            setCurrentGroup({
                ...currentGroup,
                files: Array.from(newSelected),
            });
        }
    };
    // Export configuration with validation
    const handleExportConfig = () => {
        const config = generateConfig();
        // Validate the configuration
        const validationReport = validateCodebaseViewConfig(config);
        if (!validationReport.valid) {
            console.warn('Configuration has validation issues:', validationReport);
            // Auto-fix if there are errors
            const fixedConfig = autoFixGridConfig(config);
            const revalidation = validateCodebaseViewConfig(fixedConfig);
            if (revalidation.valid) {
                console.log('Configuration auto-fixed successfully');
                if (onConfigGenerated) {
                    onConfigGenerated(fixedConfig);
                }
                return fixedConfig;
            }
        }
        if (onConfigGenerated) {
            onConfigGenerated(config);
        }
        return config;
    };
    // Reset configuration
    const resetConfig = () => {
        setGroups([]);
        setGridSize({ rows: 1, cols: 1 });
        setCurrentGroup(null);
        setSelectedDirectories(new Set());
        setWorkflowStep('idle');
        setEditingGroup(null);
        if (onGroupsChange) {
            onGroupsChange([]);
        }
    };
    const rootItems = getRootItems();
    const ungroupedCount = rootItems.filter(item => !item.isGrouped).length;
    // Validate current configuration
    const validationReport = useMemo(() => {
        const config = generateConfig();
        return validateCodebaseViewConfig(config);
    }, [groups, gridSize]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '20px' }, children: [validationReport.issues.length > 0 && (_jsxs("div", { style: {
                    padding: '12px',
                    backgroundColor: validationReport.valid ? '#fef3c7' : '#fee2e2',
                    borderRadius: t.radius.lg,
                    border: `1px solid ${validationReport.valid ? '#fbbf24' : '#fca5a5'}`,
                    fontSize: '13px',
                }, children: [_jsx("div", { style: { fontWeight: '600', marginBottom: '4px' }, children: validationReport.valid ? '⚠️ Configuration Warnings' : '❌ Configuration Issues' }), validationReport.errorCount > 0 && (_jsxs("div", { style: { color: '#dc2626' }, children: [validationReport.errorCount, " error", validationReport.errorCount !== 1 ? 's' : ''] })), validationReport.warningCount > 0 && (_jsxs("div", { style: { color: '#d97706' }, children: [validationReport.warningCount, " warning", validationReport.warningCount !== 1 ? 's' : ''] })), validationReport.suggestions.length > 0 && (_jsxs("div", { style: { marginTop: '8px', fontSize: '12px', color: t.colors.textSecondary }, children: ["\uD83D\uDCA1 ", validationReport.suggestions[0]] }))] })), _jsxs("div", { style: { display: 'flex', gap: '12px' }, children: [_jsxs("div", { style: {
                            flex: 1,
                            padding: '1rem',
                            backgroundColor: t.colors.backgroundSecondary,
                            borderRadius: t.radius.lg,
                            border: `1px solid ${t.colors.border}`,
                            textAlign: 'center',
                        }, children: [_jsx("div", { style: { fontSize: '14px', color: t.colors.textSecondary, marginBottom: '4px' }, children: "Grid Size" }), _jsxs("div", { style: { fontSize: '24px', fontWeight: 'bold', color: t.colors.primary }, children: [gridSize.rows, " \u00D7 ", gridSize.cols] }), gridSize.rows === 1 && gridSize.cols === 1 && (_jsx("button", { onClick: () => setGridSize({ rows: 2, cols: 2 }), style: {
                                    marginTop: '8px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    backgroundColor: t.colors.primary,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }, children: "Demo 2\u00D72 Grid" }))] }), _jsxs("div", { style: {
                            flex: 1,
                            padding: '1rem',
                            backgroundColor: t.colors.backgroundSecondary,
                            borderRadius: t.radius.lg,
                            border: `1px solid ${t.colors.border}`,
                            textAlign: 'center',
                        }, children: [_jsx("div", { style: { fontSize: '14px', color: t.colors.textSecondary, marginBottom: '4px' }, children: "Ungrouped" }), _jsx("div", { style: { fontSize: '24px', fontWeight: 'bold', color: t.colors.text }, children: ungroupedCount })] })] }), _jsxs("div", { style: {
                    padding: '1.5rem',
                    backgroundColor: t.colors.backgroundSecondary,
                    borderRadius: t.radius.lg,
                    border: `1px solid ${t.colors.border}`,
                }, children: [workflowStep === 'idle' && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '16px',
                                }, children: _jsx("h3", { style: { fontSize: '18px', margin: 0 }, children: "Create Groups" }) }), _jsx("p", { style: { fontSize: '14px', color: t.colors.textSecondary, marginBottom: '16px' }, children: "Organize your codebase by creating groups of related directories." }), _jsx("button", { onClick: startNewGroup, style: {
                                    ...t.components.button.primary,
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                }, children: "\uD83D\uDCE6 Create New Group" })] })), (workflowStep === 'selecting' || workflowStep === 'editing') && (_jsx(GroupSelector, { rootItems: rootItems, selectedDirectories: selectedDirectories, onToggleSelection: toggleItemSelection, onNext: () => setWorkflowStep('naming'), onCancel: () => {
                            setWorkflowStep('idle');
                            setCurrentGroup(null);
                            setSelectedDirectories(new Set());
                            setEditingGroup(null);
                        }, isEditing: workflowStep === 'editing', theme: theme })), workflowStep === 'naming' && (_jsx(GroupNaming, { selectedCount: selectedDirectories.size, currentName: currentGroup?.name || '', onNameChange: name => setCurrentGroup(prev => ({ ...prev, name })), onNext: () => {
                            if (currentGroup?.name) {
                                setWorkflowStep('positioning');
                            }
                        }, onBack: () => setWorkflowStep(editingGroup ? 'editing' : 'selecting'), theme: theme })), workflowStep === 'positioning' && (_jsx(GridPositioner, { gridSize: gridSize, groups: groups, currentGroupName: currentGroup?.name || '', onPositionSelect: (row, col) => {
                            if (editingGroup) {
                                updateGroup(row, col);
                            }
                            else {
                                placeGroupAtPosition(row, col);
                            }
                        }, onBack: () => setWorkflowStep('naming'), isEditing: !!editingGroup, editingGroupId: editingGroup, theme: theme }))] }), _jsx(GroupsList, { groups: groups, onEditGroup: startEditingGroup, onMoveGroup: groupId => {
                    const group = groups.find(g => g.id === groupId);
                    if (group) {
                        setEditingGroup(groupId);
                        setCurrentGroup({ name: group.name, files: group.files });
                        setWorkflowStep('positioning');
                    }
                }, onDeleteGroup: deleteGroup, theme: theme }), _jsxs("div", { style: { display: 'flex', gap: '12px' }, children: [_jsx("button", { onClick: handleExportConfig, style: {
                            ...t.components.button.primary,
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                        }, children: "\uD83D\uDCE5 Export Config" }), _jsx("button", { onClick: resetConfig, style: {
                            ...t.components.button.secondary,
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                        }, children: "\uD83D\uDD04 Reset" })] })] }));
};
//# sourceMappingURL=CityConfigBuilder.js.map