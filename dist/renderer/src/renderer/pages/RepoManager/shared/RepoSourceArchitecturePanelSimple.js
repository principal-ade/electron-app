import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { FolderOpen, AlertCircle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { PackageLayerModule } from "@principal-ai/codebase-composition";
import { GitHubWebAdapters } from '../../../adapters/GitHubWebAdapters';
import { ElectronPlatformAdapters } from '../../../adapters';
import { loadManifestContents } from '../../../utils/loadManifestContents';
import { DependenciesPanel } from '../../../components/repository-maps/DependenciesPanel';
/**
 * Dependencies panel for repository source
 * Analyzes package dependencies for updates, vulnerabilities, and license compliance
 * Used in Explore view to help maintain healthy dependencies
 */
export const RepoSourceArchitecturePanelSimple = ({ source, cacheService, packageLayers: packageLayersProp, onError, onPackageLayersChanged, onPackageAnalysisStart, onPackageAnalysisEnd, onPackageSelected, onPackageDeselected }) => {
    const { theme } = useTheme();
    // State
    const [loading, setLoading] = useState(true);
    const [analyzingLayers, setAnalyzingLayers] = useState(false);
    const [error, setError] = useState(null);
    const [fileSystemTree, setFileSystemTree] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(Date.now());
    // Analysis results - use prop if provided, otherwise maintain local state
    const [localPackageLayers, setLocalPackageLayers] = useState(null);
    const packageLayers = packageLayersProp ?? localPackageLayers;
    // Create adapters based on source type
    const adapters = useMemo(() => {
        if (source.type === 'remote') {
            const ref = source.metadata?.currentBranch || source.metadata?.commitSha || source.location;
            return new GitHubWebAdapters(source.owner, source.name, ref);
        }
        else if (source.type === 'local') {
            return new ElectronPlatformAdapters();
        }
        return null;
    }, [source]);
    // Load filesystem tree for the source
    useEffect(() => {
        const loadTree = async () => {
            try {
                setLoading(true);
                setError(null);
                // Load tree from cache or fetch with strong typing
                const result = await cacheService.loadFileTree(source);
                setFileSystemTree(result.tree);
                setLastRefresh(Date.now());
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to load architecture data';
                setError(errorMsg);
                if (onError)
                    onError(errorMsg);
            }
            finally {
                setLoading(false);
            }
        };
        loadTree();
    }, [source, cacheService]);
    // Only analyze layers if not provided as prop
    useEffect(() => {
        if (!fileSystemTree || !adapters || packageLayersProp)
            return;
        const analyzeLayers = async () => {
            try {
                setAnalyzingLayers(true);
                // Check cache first
                const cached = cacheService.getAnalysis(source.id);
                if (cached) {
                    setLocalPackageLayers(cached.packageLayers);
                    setAnalyzingLayers(false);
                    if (!packageLayersProp) {
                        onPackageLayersChanged?.(cached.packageLayers);
                    }
                    return;
                }
                // Add small delay for nice loading experience
                await new Promise(resolve => setTimeout(resolve, 500));
                // Create package module
                const packageModule = new PackageLayerModule();
                // Load manifest contents using utility function
                console.debug('[ArchitecturePanel] manifest load start', {
                    sourceType: source.type,
                    rootPath: source.type === 'local' ? source.location : undefined,
                    branch: source.metadata?.currentBranch,
                    commit: source.metadata?.commitSha,
                });
                const manifestContents = await loadManifestContents({
                    fileSystemTree,
                    fileSystemAdapter: adapters.fileSystem,
                    packageModule, // Reuse the same module instance
                    rootPath: source.type === 'local' ? source.location : undefined,
                });
                console.debug('[ArchitecturePanel] manifest load done', { count: manifestContents.size });
                // Package layer analysis
                const packageResult = await packageModule.discoverPackages(fileSystemTree, manifestContents);
                setLocalPackageLayers(packageResult);
                if (!packageLayersProp) {
                    onPackageLayersChanged?.(packageResult);
                }
                // Save to cache
                cacheService.setAnalysis(source.id, {
                    packageLayers: packageResult,
                });
            }
            catch (err) {
                console.error('Error analyzing layers:', err);
            }
            finally {
                setAnalyzingLayers(false);
            }
        };
        analyzeLayers();
    }, [fileSystemTree, adapters, packageLayersProp]);
    // Handle refresh
    const handleRefresh = async () => {
        // Clear caches for this source
        cacheService.removeTree(source.id);
        cacheService.removeAnalysis(source.id);
        // Trigger reload
        setLastRefresh(Date.now());
    };
    // Loading skeleton
    const LoadingSkeleton = () => (_jsxs("div", { style: {
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
        }, children: [_jsx("div", { style: {
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: `${theme.colors.primary}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    animation: 'gentlePulse 2s ease-in-out infinite',
                }, children: _jsx(FolderOpen, { size: 24, color: theme.colors.primary }) }), _jsx("h3", { style: {
                    fontSize: '15px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                }, children: "Analyzing architecture" }), _jsx("p", { style: {
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    marginBottom: '20px',
                }, children: "Discovering packages and frameworks..." }), _jsx("div", { style: {
                    display: 'flex',
                    gap: '6px',
                }, children: [...Array(3)].map((_, i) => (_jsx("div", { style: {
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: theme.colors.primary,
                        opacity: 0.3,
                        animation: 'bounce 1.4s ease-in-out infinite',
                        animationDelay: `${i * 0.2}s`,
                    } }, i))) }), _jsx("style", { children: `
        @keyframes gentlePulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          40% {
            transform: scale(1.3);
            opacity: 1;
          }
        }
      ` })] }));
    // Loading state - show loading if either fetching tree or analyzing layers
    if (loading || analyzingLayers) {
        return (_jsx("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: theme.colors.background
            }, children: _jsx(LoadingSkeleton, {}) }));
    }
    // Error state
    if (error || !fileSystemTree) {
        return (_jsx("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: theme.colors.background
            }, children: _jsx("div", { style: {
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.colors.textSecondary,
                    padding: '20px'
                }, children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx(AlertCircle, { size: 24, color: theme.colors.error || '#ff6b6b', style: { marginBottom: '8px' } }), _jsx("div", { style: { fontSize: '13px', marginBottom: '12px' }, children: error || 'Failed to load architecture data' }), _jsx("button", { onClick: handleRefresh, style: {
                                padding: '6px 12px',
                                borderRadius: '4px',
                                backgroundColor: theme.colors.primary,
                                color: '#fff',
                                border: 'none',
                                fontSize: '12px',
                                cursor: 'pointer'
                            }, children: "Try Again" })] }) }) }));
    }
    return (_jsx("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.colors.background
        }, children: _jsx(DependenciesPanel, { packageLayers: packageLayers, onAnalysisComplete: (results) => {
                console.log('Dependency analysis complete:', results);
            }, onPackageAnalysisStart: onPackageAnalysisStart, onPackageAnalysisEnd: onPackageAnalysisEnd, onPackageSelected: onPackageSelected, onPackageDeselected: onPackageDeselected }) }));
};
