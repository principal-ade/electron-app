import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { X, FolderOpen, Package, HardDrive, Filter } from 'lucide-react';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
export const ProcessingDetailsModal = ({ isOpen, onClose, selectedSource, fileTreeStats, packageLayers, filterLayers, }) => {
    const { theme } = useTheme();
    const [directoryStats, setDirectoryStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [statsError, setStatsError] = useState(null);
    // Debug logging
    useEffect(() => {
        if (isOpen) {
            console.log('[ProcessingDetailsModal] Modal opened with:', {
                selectedSource: selectedSource?.id,
                fileTreeStats,
                packageLayersCount: packageLayers?.length || 0,
                filterLayersCount: filterLayers?.length || 0,
                filterLayers
            });
        }
    }, [isOpen, filterLayers]);
    // Load directory statistics when modal opens for local sources
    useEffect(() => {
        if (!isOpen || !selectedSource || selectedSource.type !== 'local') {
            setDirectoryStats(null);
            return;
        }
        const loadDirectoryStats = async () => {
            setLoadingStats(true);
            setStatsError(null);
            try {
                // Get directory statistics from the file system
                const stats = await FileSystemService.getDirectoryStats(selectedSource.location);
                setDirectoryStats(stats);
            }
            catch (error) {
                console.error('Failed to load directory stats:', error);
                setStatsError(error instanceof Error ? error.message : 'Failed to load directory statistics');
            }
            finally {
                setLoadingStats(false);
            }
        };
        loadDirectoryStats();
    }, [isOpen, selectedSource]);
    if (!isOpen)
        return null;
    // Format file size in human readable format
    const formatFileSize = (bytes) => {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    // Group packages by type for better display
    const packagesByType = packageLayers?.reduce((acc, pkg) => {
        const type = pkg.type || 'unknown';
        if (!acc[type])
            acc[type] = [];
        acc[type].push(pkg);
        return acc;
    }, {});
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
                padding: '24px',
                maxWidth: '800px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        paddingBottom: '16px'
                    }, children: [_jsx("h2", { style: {
                                margin: 0,
                                fontSize: '20px',
                                fontWeight: 600,
                                color: theme.colors.text
                            }, children: "Repository Processing Details" }), _jsx("button", { onClick: onClose, style: {
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                fontSize: '20px',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                e.currentTarget.style.color = theme.colors.text;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = theme.colors.textSecondary;
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: { marginBottom: '24px' }, children: [_jsxs("h3", { style: {
                                fontSize: '16px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }, children: [_jsx(FolderOpen, { size: 18 }), "Source Information"] }), selectedSource ? (_jsx("div", { style: {
                                padding: '16px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '8px',
                                border: `1px solid ${theme.colors.border}`,
                            }, children: _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '16px' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }, children: "Source Type" }), _jsx("div", { style: { fontSize: '14px', fontWeight: 500, color: theme.colors.text }, children: selectedSource.type === 'local' ? 'Local Clone' : 'Remote Source' })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }, children: "Location" }), _jsx("div", { style: { fontSize: '14px', fontWeight: 500, color: theme.colors.text, fontFamily: 'monospace' }, children: selectedSource.location })] }), selectedSource.metadata?.currentBranch && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }, children: "Branch" }), _jsx("div", { style: { fontSize: '14px', fontWeight: 500, color: theme.colors.text }, children: selectedSource.metadata.currentBranch })] }))] }) })) : (_jsx("div", { style: {
                                color: theme.colors.textSecondary,
                                fontSize: '14px',
                                fontStyle: 'italic'
                            }, children: "No source selected" }))] }), _jsxs("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '24px',
                        marginBottom: '24px'
                    }, children: [_jsxs("div", { children: [_jsxs("h3", { style: {
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }, children: [_jsx(HardDrive, { size: 18 }), "File System"] }), _jsxs("div", { style: {
                                        padding: '16px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                    }, children: [selectedSource?.type === 'local' ? (loadingStats ? (_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                color: theme.colors.textSecondary
                                            }, children: [_jsx("div", { style: {
                                                        width: '16px',
                                                        height: '16px',
                                                        border: `2px solid ${theme.colors.border}`,
                                                        borderTop: `2px solid ${theme.colors.primary}`,
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite'
                                                    } }), "Loading directory statistics..."] })) : statsError ? (_jsxs("div", { style: { color: theme.colors.error, fontSize: '14px' }, children: ["Error: ", statsError] })) : directoryStats ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Total Files:" }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: directoryStats.totalFiles.toLocaleString() })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Total Directories:" }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: directoryStats.totalDirectories.toLocaleString() })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Total Size:" }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: formatFileSize(directoryStats.totalSize) })] })] })) : (_jsx("div", { style: { color: theme.colors.textSecondary, fontSize: '14px' }, children: "No directory statistics available" }))) : (_jsx("div", { style: { color: theme.colors.textSecondary, fontSize: '14px' }, children: "Directory statistics only available for local sources" })), fileTreeStats && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                                        height: '1px',
                                                        backgroundColor: theme.colors.border,
                                                        margin: '16px 0'
                                                    } }), _jsx("div", { style: { marginBottom: '8px', fontWeight: 500, color: theme.colors.text }, children: "File Tree (Processed):" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Files:" }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: fileTreeStats.fileCount.toLocaleString() })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Directories:" }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: fileTreeStats.directoryCount.toLocaleString() })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Loaded At:" }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: new Date(fileTreeStats.loadedAt).toLocaleTimeString() })] })] })] })), filterLayers && filterLayers.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                                        height: '1px',
                                                        backgroundColor: theme.colors.border,
                                                        margin: '16px 0'
                                                    } }), _jsxs("div", { style: { marginBottom: '8px', fontWeight: 500, color: theme.colors.text, display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(Filter, { size: 14 }), "Applied Filters (", filterLayers.length, "):"] }), _jsx("div", { style: {
                                                        maxHeight: '150px',
                                                        overflowY: 'auto',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '6px'
                                                    }, children: filterLayers.map((filter, index) => (_jsxs("div", { style: {
                                                            padding: '6px 8px',
                                                            backgroundColor: theme.colors.background,
                                                            borderRadius: '4px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            fontSize: '11px'
                                                        }, children: [_jsx("div", { style: {
                                                                    fontWeight: 500,
                                                                    color: filter.enabled ? theme.colors.text : theme.colors.textTertiary,
                                                                    marginBottom: '2px'
                                                                }, children: filter.name || `Filter ${index + 1}` }), filter.filterData && (_jsxs(_Fragment, { children: [filter.filterData.purpose && (_jsxs("div", { style: {
                                                                            color: theme.colors.textSecondary,
                                                                            fontSize: '10px'
                                                                        }, children: ["Purpose: ", filter.filterData.purpose] })), filter.filterData.excludedPatterns && filter.filterData.excludedPatterns.length > 0 && (_jsxs("div", { style: {
                                                                            color: theme.colors.textSecondary,
                                                                            fontSize: '10px',
                                                                            marginTop: '2px'
                                                                        }, children: ["Patterns: ", filter.filterData.excludedPatterns.length, " excluded"] }))] })), filter.derivedFrom?.description && (_jsx("div", { style: {
                                                                    color: theme.colors.textTertiary,
                                                                    fontSize: '10px',
                                                                    marginTop: '2px',
                                                                    fontStyle: 'italic'
                                                                }, children: filter.derivedFrom.description }))] }, index))) }), directoryStats && fileTreeStats && (_jsxs("div", { style: {
                                                        marginTop: '8px',
                                                        padding: '8px',
                                                        backgroundColor: theme.colors.backgroundTertiary,
                                                        borderRadius: '4px',
                                                        fontSize: '12px'
                                                    }, children: [_jsx("div", { style: { color: theme.colors.textSecondary, marginBottom: '4px' }, children: "Filter Impact:" }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { children: "Files filtered out:" }), _jsxs("span", { style: { fontWeight: 500, color: theme.colors.error }, children: [(directoryStats.totalFiles - fileTreeStats.fileCount).toLocaleString(), ' ', "(", Math.round(((directoryStats.totalFiles - fileTreeStats.fileCount) / directoryStats.totalFiles) * 100), "%)"] })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { children: "Directories filtered out:" }), _jsxs("span", { style: { fontWeight: 500, color: theme.colors.error }, children: [(directoryStats.totalDirectories - fileTreeStats.directoryCount).toLocaleString(), ' ', "(", Math.round(((directoryStats.totalDirectories - fileTreeStats.directoryCount) / directoryStats.totalDirectories) * 100), "%)"] })] })] }))] }))] })] }), _jsxs("div", { children: [_jsxs("h3", { style: {
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }, children: [_jsx(Package, { size: 18 }), "Package Analysis"] }), _jsx("div", { style: {
                                        padding: '16px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                        height: 'fit-content'
                                    }, children: packageLayers && packageLayers.length > 0 ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { style: {
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '8px'
                                                }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Total Packages:" }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: packageLayers.length })] }), packagesByType && Object.keys(packagesByType).length > 0 && (_jsxs("div", { children: [_jsx("div", { style: {
                                                            fontSize: '14px',
                                                            fontWeight: 500,
                                                            color: theme.colors.text,
                                                            marginBottom: '8px'
                                                        }, children: "By Type:" }), Object.entries(packagesByType).map(([type, packages]) => (_jsxs("div", { style: {
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            fontSize: '13px',
                                                            marginBottom: '4px'
                                                        }, children: [_jsxs("span", { style: { color: theme.colors.textSecondary, textTransform: 'capitalize' }, children: [type, ":"] }), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: packages.length })] }, type)))] })), _jsxs("div", { children: [_jsx("div", { style: {
                                                            fontSize: '14px',
                                                            fontWeight: 500,
                                                            color: theme.colors.text,
                                                            marginBottom: '8px'
                                                        }, children: "Packages:" }), _jsx("div", { style: {
                                                            maxHeight: '200px',
                                                            overflowY: 'auto',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '4px'
                                                        }, children: packageLayers.map((pkg, index) => (_jsxs("div", { style: {
                                                                padding: '8px',
                                                                backgroundColor: theme.colors.background,
                                                                borderRadius: '4px',
                                                                border: `1px solid ${theme.colors.border}`,
                                                                fontSize: '12px'
                                                            }, children: [_jsx("div", { style: {
                                                                        fontWeight: 500,
                                                                        color: theme.colors.text,
                                                                        marginBottom: '2px'
                                                                    }, children: pkg.packageData?.name || 'Unknown Package' }), pkg.packageData?.path && (_jsx("div", { style: {
                                                                        color: theme.colors.textSecondary,
                                                                        fontFamily: 'monospace',
                                                                        fontSize: '11px'
                                                                    }, children: pkg.packageData.path })), pkg.type && (_jsxs("div", { style: {
                                                                        fontSize: '11px',
                                                                        color: theme.colors.textTertiary,
                                                                        textTransform: 'capitalize',
                                                                        marginTop: '2px'
                                                                    }, children: ["Type: ", pkg.type] }))] }, index))) })] })] })) : (_jsx("div", { style: { color: theme.colors.textSecondary, fontSize: '14px' }, children: "No packages detected" })) })] })] })] }) }));
};
