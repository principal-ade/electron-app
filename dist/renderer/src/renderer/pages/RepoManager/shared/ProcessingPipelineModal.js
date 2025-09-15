import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { X, FolderOpen, Package, Filter, ArrowRight, ChevronDown, ChevronRight, AlertCircle, CheckCircle, XCircle, Folder, TestTube, Eye } from 'lucide-react';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
export const ProcessingPipelineModal = ({ isOpen, onClose, selectedSource, fileTreeStats, packageLayers, filterLayers, }) => {
    const { theme } = useTheme();
    const [directoryStats, setDirectoryStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [expandedStages, setExpandedStages] = useState(new Set());
    const [expandedFilters, setExpandedFilters] = useState(new Set());
    const [testResults, setTestResults] = useState(new Map());
    const [showingResults, setShowingResults] = useState(new Set());
    // Debug logging
    useEffect(() => {
        if (isOpen) {
            console.log('[ProcessingPipelineModal] Modal opened with:', {
                selectedSource: selectedSource?.id,
                fileTreeStats,
                packageLayersCount: packageLayers?.length || 0,
                filterLayersCount: filterLayers?.length || 0,
                hasFilterLayers: !!filterLayers,
                filterLayersType: typeof filterLayers,
                filterLayers: filterLayers
            });
            // Log all filter patterns for debugging
            if (filterLayers && filterLayers.length > 0) {
                console.log('[ProcessingPipelineModal] Active filters:');
                filterLayers.forEach((filter, index) => {
                    console.log(`  Filter ${index + 1}: ${filter.name || 'Unnamed'}`);
                    console.log(`    Enabled: ${filter.enabled}`);
                    if (filter.filterData?.excludedPatterns) {
                        console.log(`    Patterns (${filter.filterData.excludedPatterns.length}):`);
                        filter.filterData.excludedPatterns.forEach((p) => {
                            console.log(`      - ${p.pattern}`);
                        });
                    }
                });
            }
        }
    }, [isOpen, filterLayers, fileTreeStats]);
    // Load directory statistics when modal opens for local sources
    useEffect(() => {
        if (!isOpen || !selectedSource || selectedSource.type !== 'local') {
            setDirectoryStats(null);
            return;
        }
        const loadDirectoryStats = async () => {
            setLoadingStats(true);
            try {
                const stats = await FileSystemService.getDirectoryStats(selectedSource.location);
                setDirectoryStats(stats);
            }
            catch (error) {
                console.error('Failed to load directory stats:', error);
            }
            finally {
                setLoadingStats(false);
            }
        };
        loadDirectoryStats();
    }, [isOpen, selectedSource]);
    if (!isOpen)
        return null;
    const formatNumber = (num) => num.toLocaleString();
    const formatFileSize = (bytes) => {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    const toggleStageExpanded = (index) => {
        const newExpanded = new Set(expandedStages);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        }
        else {
            newExpanded.add(index);
        }
        setExpandedStages(newExpanded);
    };
    const toggleFilterExpanded = (filterId) => {
        const newExpanded = new Set(expandedFilters);
        if (newExpanded.has(filterId)) {
            newExpanded.delete(filterId);
        }
        else {
            newExpanded.add(filterId);
        }
        setExpandedFilters(newExpanded);
    };
    const testFilterPatterns = async (filterIndex, filter) => {
        if (!selectedSource || !filter.filterData?.excludedPatterns) {
            return;
        }
        // Set loading state
        const newResults = new Map(testResults);
        newResults.set(filterIndex, {
            matchedFiles: [],
            totalFiles: 0,
            loading: true
        });
        setTestResults(newResults);
        try {
            // Get the directory path to test against
            const directoryPath = selectedSource.type === 'local'
                ? selectedSource.location
                : '';
            if (!directoryPath && selectedSource.type === 'local') {
                throw new Error('No directory path available for local source');
            }
            // For GitHub sources, we can't really test against the file system
            if (selectedSource.type !== 'local') {
                throw new Error('Pattern testing is only available for local repositories');
            }
            // Get all files in the directory using our buildFilteredFileTree method
            // but without any filters to get the complete list
            const allFilesResult = await FileSystemService.buildFilteredFileTree(directoryPath, []);
            const allFiles = allFilesResult.paths.filter(path => !path.endsWith('/')); // Only files, not directories
            // Test each file against the filter patterns
            const patterns = filter.filterData.excludedPatterns.map((p) => p.pattern);
            // Import ignore library to test patterns
            const ignore = (await import('ignore')).default;
            const ig = ignore();
            ig.add(patterns);
            const matchedFiles = [];
            allFiles.forEach(filePath => {
                if (ig.ignores(filePath)) {
                    matchedFiles.push(filePath);
                }
            });
            // Update results
            const updatedResults = new Map(testResults);
            updatedResults.set(filterIndex, {
                matchedFiles,
                totalFiles: allFiles.length,
                loading: false
            });
            setTestResults(updatedResults);
            // Show results
            const newShowing = new Set(showingResults);
            newShowing.add(filterIndex);
            setShowingResults(newShowing);
        }
        catch (error) {
            const updatedResults = new Map(testResults);
            updatedResults.set(filterIndex, {
                matchedFiles: [],
                totalFiles: 0,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            });
            setTestResults(updatedResults);
        }
    };
    const toggleTestResults = (filterIndex) => {
        const newShowing = new Set(showingResults);
        if (newShowing.has(filterIndex)) {
            newShowing.delete(filterIndex);
        }
        else {
            newShowing.add(filterIndex);
        }
        setShowingResults(newShowing);
    };
    // Build pipeline stages
    const pipelineStages = [];
    // Stage 1: File System Scan
    if (directoryStats) {
        pipelineStages.push({
            name: 'File System Scan',
            icon: _jsx(FolderOpen, { size: 16 }),
            inputFiles: 0,
            outputFiles: directoryStats.totalFiles,
            inputDirs: 0,
            outputDirs: directoryStats.totalDirectories,
            description: `Scanned ${selectedSource?.location || 'directory'} (${formatFileSize(directoryStats.totalSize)})`,
            status: 'success'
        });
    }
    // Stage 2: Filter Application
    // Show this stage if there's any difference between scan and tree, or if we have filters
    if (directoryStats && fileTreeStats) {
        const filesRemoved = directoryStats.totalFiles - fileTreeStats.fileCount;
        const dirsRemoved = directoryStats.totalDirectories - fileTreeStats.directoryCount;
        const hasFilters = filterLayers && filterLayers.length > 0;
        // Always show filter stage if files were removed OR if we have filters
        if (filesRemoved > 0 || dirsRemoved > 0 || hasFilters) {
            pipelineStages.push({
                name: 'Apply Filters',
                icon: _jsx(Filter, { size: 16 }),
                inputFiles: directoryStats.totalFiles,
                outputFiles: fileTreeStats.fileCount,
                inputDirs: directoryStats.totalDirectories,
                outputDirs: fileTreeStats.directoryCount,
                description: hasFilters
                    ? `Applied ${filterLayers.length} filter${filterLayers.length > 1 ? 's' : ''}`
                    : `Filtered ${filesRemoved} files and ${dirsRemoved} directories (filters may be built-in or from config)`,
                filters: filterLayers || undefined,
                status: filesRemoved > directoryStats.totalFiles * 0.9 ? 'warning' : 'success'
            });
        }
    }
    // Stage 3: Tree Building
    if (fileTreeStats) {
        pipelineStages.push({
            name: 'Build File Tree',
            icon: _jsx(Folder, { size: 16 }),
            inputFiles: fileTreeStats.fileCount,
            outputFiles: fileTreeStats.fileCount,
            inputDirs: fileTreeStats.directoryCount,
            outputDirs: fileTreeStats.directoryCount,
            description: 'Constructed hierarchical tree structure',
            status: fileTreeStats.fileCount > 0 ? 'success' : 'error'
        });
    }
    // Stage 4: Package Discovery
    if (packageLayers) {
        pipelineStages.push({
            name: 'Package Discovery',
            icon: _jsx(Package, { size: 16 }),
            inputFiles: fileTreeStats?.fileCount || 0,
            outputFiles: fileTreeStats?.fileCount || 0,
            inputDirs: fileTreeStats?.directoryCount || 0,
            outputDirs: fileTreeStats?.directoryCount || 0,
            description: `Found ${packageLayers.length} package${packageLayers.length !== 1 ? 's' : ''}`,
            status: packageLayers.length > 0 ? 'success' : 'warning'
        });
    }
    const getStageStatusIcon = (status) => {
        switch (status) {
            case 'success':
                return _jsx(CheckCircle, { size: 14, color: theme.colors.success });
            case 'warning':
                return _jsx(AlertCircle, { size: 14, color: theme.colors.warning });
            case 'error':
                return _jsx(XCircle, { size: 14, color: theme.colors.error });
            default:
                return null;
        }
    };
    const getPercentageChange = (input, output) => {
        if (input === 0)
            return '+100%';
        const change = ((output - input) / input) * 100;
        return `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                width: '90%',
                maxWidth: '1000px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }, children: [_jsxs("div", { style: {
                        padding: '20px 24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                    }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                        margin: 0,
                                        fontSize: '20px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '4px'
                                    }, children: "Repository Processing Pipeline" }), selectedSource && (_jsxs("div", { style: {
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        fontFamily: 'monospace'
                                    }, children: [selectedSource.label, " \u2022 ", selectedSource.location] }))] }), _jsx("button", { onClick: onClose, style: {
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: {
                        flex: 1,
                        overflow: 'auto',
                        padding: '24px',
                    }, children: [filterLayers && filterLayers.length > 0 && (_jsxs("div", { style: {
                                marginBottom: '24px',
                                padding: '16px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '8px',
                                border: `1px solid ${theme.colors.border}`,
                            }, children: [_jsxs("h3", { style: {
                                        margin: '0 0 16px 0',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                    }, children: ["Active Filters (", filterLayers.filter(f => f.enabled).length, " of ", filterLayers.length, " enabled)"] }), filterLayers.map((filter, index) => (_jsxs("div", { style: {
                                        marginBottom: '12px',
                                        padding: '12px',
                                        backgroundColor: theme.colors.background,
                                        borderRadius: '6px',
                                        border: `1px solid ${filter.enabled ? theme.colors.primary : theme.colors.border}`,
                                        opacity: filter.enabled ? 1 : 0.6,
                                    }, children: [_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                            }, children: [_jsxs("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                    }, children: [_jsx("div", { style: {
                                                                width: '8px',
                                                                height: '8px',
                                                                borderRadius: '50%',
                                                                backgroundColor: filter.enabled ? theme.colors.success : theme.colors.textTertiary,
                                                            } }), _jsx("strong", { style: { color: theme.colors.text }, children: filter.name || `Filter ${index + 1}` })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [filter.filterData?.excludedPatterns && (_jsxs("span", { style: {
                                                                fontSize: '12px',
                                                                color: theme.colors.textSecondary,
                                                                backgroundColor: theme.colors.backgroundTertiary,
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                            }, children: [filter.filterData.excludedPatterns.length, " patterns"] })), filter.enabled && filter.filterData?.excludedPatterns && selectedSource?.type === 'local' && (_jsxs("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                testFilterPatterns(index, filter);
                                                            }, style: {
                                                                backgroundColor: theme.colors.primary,
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                padding: '4px 8px',
                                                                fontSize: '11px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                            }, title: "Test this filter to see which files it matches", children: [_jsx(TestTube, { size: 12 }), "Test"] })), testResults.has(index) && !testResults.get(index)?.loading && (_jsxs("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                toggleTestResults(index);
                                                            }, style: {
                                                                backgroundColor: 'transparent',
                                                                color: theme.colors.primary,
                                                                border: `1px solid ${theme.colors.primary}`,
                                                                borderRadius: '4px',
                                                                padding: '4px 8px',
                                                                fontSize: '11px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                            }, title: "View test results", children: [_jsx(Eye, { size: 12 }), showingResults.has(index) ? 'Hide' : 'Results'] }))] })] }), filter.filterData?.purpose && (_jsx("div", { style: {
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary,
                                                marginBottom: '4px',
                                            }, children: filter.filterData.purpose })), filter.filterData?.excludedPatterns && filter.filterData.excludedPatterns.length > 0 && (_jsxs("details", { style: { marginTop: '8px' }, children: [_jsx("summary", { style: {
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        color: theme.colors.primary,
                                                        marginBottom: '4px',
                                                    }, children: "Show patterns" }), _jsx("div", { style: {
                                                        marginTop: '8px',
                                                        padding: '8px',
                                                        backgroundColor: theme.colors.backgroundTertiary,
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontFamily: 'monospace',
                                                        maxHeight: '150px',
                                                        overflowY: 'auto',
                                                    }, children: filter.filterData.excludedPatterns.map((pattern, pIndex) => (_jsx("div", { style: {
                                                            marginBottom: '2px',
                                                            color: theme.colors.text,
                                                        }, children: pattern.pattern }, pIndex))) })] })), showingResults.has(index) && testResults.has(index) && (_jsx("div", { style: {
                                                marginTop: '12px',
                                                padding: '12px',
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                borderRadius: '6px',
                                                border: `1px solid ${theme.colors.border}`,
                                            }, children: (() => {
                                                const result = testResults.get(index);
                                                if (!result)
                                                    return null;
                                                if (result.loading) {
                                                    return (_jsxs("div", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            color: theme.colors.textSecondary,
                                                            fontSize: '12px',
                                                        }, children: [_jsx("div", { style: {
                                                                    width: '12px',
                                                                    height: '12px',
                                                                    border: `2px solid ${theme.colors.textSecondary}`,
                                                                    borderTop: `2px solid ${theme.colors.primary}`,
                                                                    borderRadius: '50%',
                                                                    animation: 'spin 1s linear infinite'
                                                                } }), "Testing filter patterns..."] }));
                                                }
                                                if (result.error) {
                                                    return (_jsxs("div", { style: {
                                                            color: theme.colors.error,
                                                            fontSize: '12px',
                                                        }, children: [_jsx("strong", { children: "Error:" }), " ", result.error] }));
                                                }
                                                return (_jsxs("div", { children: [_jsxs("div", { style: {
                                                                fontSize: '13px',
                                                                fontWeight: 500,
                                                                color: theme.colors.text,
                                                                marginBottom: '8px',
                                                            }, children: ["Test Results: ", result.matchedFiles.length, " files would be excluded", result.totalFiles > 0 && ` (out of ${result.totalFiles} total files)`] }), result.matchedFiles.length > 0 && (_jsxs("div", { style: {
                                                                maxHeight: '200px',
                                                                overflowY: 'auto',
                                                                backgroundColor: theme.colors.background,
                                                                borderRadius: '4px',
                                                                padding: '8px',
                                                            }, children: [_jsx("div", { style: {
                                                                        fontSize: '12px',
                                                                        color: theme.colors.textSecondary,
                                                                        marginBottom: '6px',
                                                                    }, children: "Files that would be excluded by this filter:" }), result.matchedFiles.map((filePath, fileIndex) => (_jsx("div", { style: {
                                                                        fontSize: '11px',
                                                                        fontFamily: 'monospace',
                                                                        color: theme.colors.text,
                                                                        marginBottom: '2px',
                                                                        padding: '2px 4px',
                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                        borderRadius: '2px',
                                                                    }, children: filePath }, fileIndex)))] })), result.matchedFiles.length === 0 && (_jsx("div", { style: {
                                                                fontSize: '12px',
                                                                color: theme.colors.success,
                                                                fontStyle: 'italic',
                                                            }, children: "No files would be excluded by this filter" }))] }));
                                            })() }))] }, index))), fileTreeStats && (_jsxs("div", { style: {
                                        marginTop: '16px',
                                        padding: '8px',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                    }, children: [_jsx("strong", { children: "Result:" }), " ", fileTreeStats.fileCount, " files, ", fileTreeStats.directoryCount, " directories", directoryStats && (_jsxs("span", { children: [" (filtered from ", directoryStats.totalFiles, " files, ", directoryStats.totalDirectories, " directories)"] }))] }))] })), _jsx("div", { style: { marginBottom: '32px' }, children: pipelineStages.map((stage, index) => (_jsxs(React.Fragment, { children: [_jsxs("div", { style: {
                                            backgroundColor: theme.colors.backgroundSecondary,
                                            border: `1px solid ${theme.colors.border}`,
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                        }, children: [_jsxs("div", { style: {
                                                    padding: '12px 16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    cursor: stage.filters ? 'pointer' : 'default',
                                                    transition: 'background-color 0.2s',
                                                }, onClick: () => stage.filters && toggleStageExpanded(index), onMouseEnter: (e) => {
                                                    if (stage.filters) {
                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [stage.filters && (expandedStages.has(index) ?
                                                                _jsx(ChevronDown, { size: 16, color: theme.colors.textSecondary }) :
                                                                _jsx(ChevronRight, { size: 16, color: theme.colors.textSecondary })), _jsx("div", { style: { color: theme.colors.primary }, children: stage.icon }), _jsxs("div", { children: [_jsxs("div", { style: {
                                                                            fontSize: '14px',
                                                                            fontWeight: 600,
                                                                            color: theme.colors.text,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '8px'
                                                                        }, children: [stage.name, getStageStatusIcon(stage.status)] }), stage.description && (_jsx("div", { style: {
                                                                            fontSize: '12px',
                                                                            color: theme.colors.textSecondary,
                                                                            marginTop: '2px'
                                                                        }, children: stage.description }))] })] }), _jsxs("div", { style: { display: 'flex', gap: '24px' }, children: [_jsxs("div", { style: { textAlign: 'right' }, children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Files" }), _jsxs("div", { style: {
                                                                            fontSize: '14px',
                                                                            fontWeight: 500,
                                                                            color: theme.colors.text,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '8px'
                                                                        }, children: [stage.inputFiles > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { children: formatNumber(stage.inputFiles) }), _jsx(ArrowRight, { size: 14, color: theme.colors.textSecondary })] })), _jsx("span", { children: formatNumber(stage.outputFiles) }), stage.inputFiles !== stage.outputFiles && stage.inputFiles > 0 && (_jsxs("span", { style: {
                                                                                    fontSize: '11px',
                                                                                    color: stage.outputFiles < stage.inputFiles ? theme.colors.error : theme.colors.success
                                                                                }, children: ["(", getPercentageChange(stage.inputFiles, stage.outputFiles), ")"] }))] })] }), _jsxs("div", { style: { textAlign: 'right' }, children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Directories" }), _jsxs("div", { style: {
                                                                            fontSize: '14px',
                                                                            fontWeight: 500,
                                                                            color: theme.colors.text,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '8px'
                                                                        }, children: [stage.inputDirs > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { children: formatNumber(stage.inputDirs) }), _jsx(ArrowRight, { size: 14, color: theme.colors.textSecondary })] })), _jsx("span", { children: formatNumber(stage.outputDirs) }), stage.inputDirs !== stage.outputDirs && stage.inputDirs > 0 && (_jsxs("span", { style: {
                                                                                    fontSize: '11px',
                                                                                    color: stage.outputDirs < stage.inputDirs ? theme.colors.error : theme.colors.success
                                                                                }, children: ["(", getPercentageChange(stage.inputDirs, stage.outputDirs), ")"] }))] })] })] })] }), stage.filters && expandedStages.has(index) && (_jsxs("div", { style: {
                                                    borderTop: `1px solid ${theme.colors.border}`,
                                                    padding: '16px',
                                                    backgroundColor: theme.colors.background,
                                                }, children: [_jsx("div", { style: {
                                                            fontSize: '13px',
                                                            fontWeight: 500,
                                                            color: theme.colors.text,
                                                            marginBottom: '12px'
                                                        }, children: "Active Filters:" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: stage.filters.map((filter, filterIndex) => {
                                                            const filterId = `${index}-${filterIndex}`;
                                                            const isExpanded = expandedFilters.has(filterId);
                                                            return (_jsxs("div", { style: {
                                                                    backgroundColor: theme.colors.backgroundSecondary,
                                                                    borderRadius: '6px',
                                                                    border: `1px solid ${theme.colors.border}`,
                                                                    overflow: 'hidden',
                                                                }, children: [_jsxs("div", { style: {
                                                                            padding: '10px 12px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            cursor: 'pointer',
                                                                        }, onClick: () => toggleFilterExpanded(filterId), children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [isExpanded ?
                                                                                        _jsx(ChevronDown, { size: 14, color: theme.colors.textSecondary }) :
                                                                                        _jsx(ChevronRight, { size: 14, color: theme.colors.textSecondary }), _jsx("div", { style: {
                                                                                            width: '8px',
                                                                                            height: '8px',
                                                                                            borderRadius: '50%',
                                                                                            backgroundColor: filter.enabled ? theme.colors.success : theme.colors.textTertiary
                                                                                        } }), _jsx("div", { style: {
                                                                                            fontSize: '13px',
                                                                                            fontWeight: 500,
                                                                                            color: filter.enabled ? theme.colors.text : theme.colors.textTertiary
                                                                                        }, children: filter.name || `Filter ${filterIndex + 1}` })] }), filter.filterData?.excludedPatterns && (_jsxs("div", { style: {
                                                                                    fontSize: '12px',
                                                                                    color: theme.colors.textSecondary,
                                                                                    backgroundColor: theme.colors.backgroundTertiary,
                                                                                    padding: '2px 8px',
                                                                                    borderRadius: '4px'
                                                                                }, children: [filter.filterData.excludedPatterns.length, " patterns"] }))] }), isExpanded && (_jsxs("div", { style: {
                                                                            padding: '12px',
                                                                            borderTop: `1px solid ${theme.colors.border}`,
                                                                            backgroundColor: theme.colors.background,
                                                                            fontSize: '12px',
                                                                        }, children: [filter.filterData?.purpose && (_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Purpose: " }), _jsx("span", { style: { color: theme.colors.text }, children: filter.filterData.purpose })] })), filter.filterData?.scope && (_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Scope: " }), _jsx("span", { style: { color: theme.colors.text }, children: filter.filterData.scope })] })), filter.derivedFrom?.description && (_jsx("div", { style: {
                                                                                    marginBottom: '8px',
                                                                                    fontStyle: 'italic',
                                                                                    color: theme.colors.textTertiary
                                                                                }, children: filter.derivedFrom.description })), filter.filterData?.excludedPatterns && filter.filterData.excludedPatterns.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: {
                                                                                            color: theme.colors.textSecondary,
                                                                                            marginBottom: '6px'
                                                                                        }, children: "Excluded patterns:" }), _jsxs("div", { style: {
                                                                                            maxHeight: '120px',
                                                                                            overflowY: 'auto',
                                                                                            backgroundColor: theme.colors.backgroundSecondary,
                                                                                            borderRadius: '4px',
                                                                                            padding: '8px',
                                                                                            fontFamily: 'monospace',
                                                                                            fontSize: '11px'
                                                                                        }, children: [filter.filterData.excludedPatterns.slice(0, 10).map((pattern, i) => (_jsxs("div", { style: {
                                                                                                    color: theme.colors.text,
                                                                                                    marginBottom: '2px'
                                                                                                }, children: [pattern.pattern, pattern.description && (_jsxs("span", { style: {
                                                                                                            color: theme.colors.textTertiary,
                                                                                                            marginLeft: '8px'
                                                                                                        }, children: ["// ", pattern.description] }))] }, i))), filter.filterData.excludedPatterns.length > 10 && (_jsxs("div", { style: {
                                                                                                    color: theme.colors.textTertiary,
                                                                                                    marginTop: '4px'
                                                                                                }, children: ["... and ", filter.filterData.excludedPatterns.length - 10, " more"] }))] })] }))] }))] }, filterIndex));
                                                        }) })] }))] }), index < pipelineStages.length - 1 && (_jsx("div", { style: {
                                            display: 'flex',
                                            justifyContent: 'center',
                                            padding: '16px 0',
                                        }, children: _jsx("div", { style: {
                                                width: '2px',
                                                height: '32px',
                                                backgroundColor: theme.colors.border,
                                                position: 'relative',
                                            }, children: _jsx("div", { style: {
                                                    position: 'absolute',
                                                    bottom: '-6px',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    width: 0,
                                                    height: 0,
                                                    borderLeft: '6px solid transparent',
                                                    borderRight: '6px solid transparent',
                                                    borderTop: `6px solid ${theme.colors.border}`,
                                                } }) }) }))] }, index))) }), directoryStats && fileTreeStats && (_jsxs("div", { style: {
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '8px',
                                padding: '16px',
                                border: `1px solid ${theme.colors.border}`,
                            }, children: [_jsx("h3", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginTop: 0,
                                        marginBottom: '12px'
                                    }, children: "Processing Summary" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }, children: "Total Processed" }), _jsx("div", { style: { fontSize: '20px', fontWeight: 600, color: theme.colors.text }, children: fileTreeStats.fileCount === 0 ? (_jsx("span", { style: { color: theme.colors.error }, children: "No files" })) : (_jsxs(_Fragment, { children: [formatNumber(fileTreeStats.fileCount), _jsx("span", { style: { fontSize: '14px', fontWeight: 400, color: theme.colors.textSecondary }, children: " files" })] })) })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }, children: "Filter Efficiency" }), _jsxs("div", { style: { fontSize: '20px', fontWeight: 600, color: theme.colors.text }, children: [Math.round(((directoryStats.totalFiles - fileTreeStats.fileCount) / directoryStats.totalFiles) * 100), "%", _jsx("span", { style: { fontSize: '14px', fontWeight: 400, color: theme.colors.textSecondary }, children: " removed" })] })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }, children: "Packages Found" }), _jsxs("div", { style: { fontSize: '20px', fontWeight: 600, color: theme.colors.text }, children: [packageLayers?.length || 0, _jsx("span", { style: { fontSize: '14px', fontWeight: 400, color: theme.colors.textSecondary }, children: " packages" })] })] })] }), fileTreeStats.fileCount === 0 && (_jsxs("div", { style: {
                                        marginTop: '16px',
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        borderRadius: '6px',
                                        border: `1px solid ${theme.colors.warning}`,
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '8px'
                                    }, children: [_jsx(AlertCircle, { size: 16, color: theme.colors.warning, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: '13px', fontWeight: 500, color: theme.colors.text, marginBottom: '4px' }, children: "All files were filtered out" }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '12px' }, children: "Your filters are excluding all files from the repository. Consider adjusting your filter configuration to include the files you want to visualize." }), filterLayers && filterLayers.length > 0 && (_jsxs("div", { style: {
                                                        marginTop: '12px',
                                                        padding: '10px',
                                                        backgroundColor: theme.colors.background,
                                                        borderRadius: '4px',
                                                        border: `1px solid ${theme.colors.border}`
                                                    }, children: [_jsxs("div", { style: { fontSize: '11px', fontWeight: 600, color: theme.colors.textSecondary, marginBottom: '8px', textTransform: 'uppercase' }, children: ["Active Filters (", filterLayers.length, ")"] }), filterLayers.map((filter, index) => (_jsxs("div", { style: {
                                                                marginBottom: index < filterLayers.length - 1 ? '10px' : 0,
                                                                padding: '8px',
                                                                backgroundColor: theme.colors.backgroundSecondary,
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }, children: [_jsxs("div", { style: {
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                        marginBottom: '6px'
                                                                    }, children: [_jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: filter.name || `Filter ${index + 1}` }), filter.enabled !== false && (_jsx("button", { onClick: () => testFilterPatterns(index, filter), disabled: testResults.get(index)?.loading, style: {
                                                                                padding: '2px 8px',
                                                                                fontSize: '11px',
                                                                                backgroundColor: theme.colors.primary,
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '3px',
                                                                                cursor: testResults.get(index)?.loading ? 'not-allowed' : 'pointer',
                                                                                opacity: testResults.get(index)?.loading ? 0.6 : 1
                                                                            }, children: testResults.get(index)?.loading ? 'Testing...' : 'Test' }))] }), _jsx("div", { style: { color: theme.colors.textSecondary }, children: filter.patterns && filter.patterns.length > 0 ? (_jsxs("div", { children: [_jsxs("div", { style: { fontSize: '11px', marginBottom: '4px' }, children: ["Patterns (", filter.patterns.length, "):"] }), _jsxs("div", { style: {
                                                                                    fontFamily: 'monospace',
                                                                                    fontSize: '11px',
                                                                                    backgroundColor: theme.colors.background,
                                                                                    padding: '4px 6px',
                                                                                    borderRadius: '3px',
                                                                                    maxHeight: '60px',
                                                                                    overflowY: 'auto'
                                                                                }, children: [filter.patterns.slice(0, 5).map((pattern, pIndex) => (_jsx("div", { children: pattern }, pIndex))), filter.patterns.length > 5 && (_jsxs("div", { style: { color: theme.colors.textTertiary }, children: ["...and ", filter.patterns.length - 5, " more"] }))] })] })) : (_jsx("span", { style: { fontSize: '11px', fontStyle: 'italic' }, children: "No patterns defined" })) }), testResults.has(index) && showingResults.has(index) && (_jsx("div", { style: {
                                                                        marginTop: '8px',
                                                                        padding: '6px',
                                                                        backgroundColor: theme.colors.background,
                                                                        borderRadius: '3px',
                                                                        fontSize: '11px'
                                                                    }, children: testResults.get(index)?.error ? (_jsxs("div", { style: { color: theme.colors.error }, children: ["Error: ", testResults.get(index)?.error] })) : (_jsxs("div", { children: [_jsxs("div", { style: { marginBottom: '4px', color: theme.colors.warning }, children: [testResults.get(index)?.matchedFiles.length, " files would be excluded"] }), testResults.get(index)?.matchedFiles.length > 0 && (_jsxs("div", { style: {
                                                                                    maxHeight: '100px',
                                                                                    overflowY: 'auto',
                                                                                    padding: '4px',
                                                                                    backgroundColor: theme.colors.backgroundSecondary,
                                                                                    borderRadius: '2px'
                                                                                }, children: [testResults.get(index)?.matchedFiles.slice(0, 10).map((file, fIndex) => (_jsx("div", { style: { color: theme.colors.textSecondary }, children: file }, fIndex))), testResults.get(index)?.matchedFiles.length > 10 && (_jsxs("div", { style: { color: theme.colors.textTertiary, marginTop: '4px' }, children: ["...and ", testResults.get(index)?.matchedFiles.length - 10, " more"] }))] }))] })) }))] }, index)))] }))] })] }))] }))] })] }) }));
};
