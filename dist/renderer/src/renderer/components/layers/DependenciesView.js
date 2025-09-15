import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
export const DependenciesView = ({ packageDirs, workingDirectory, enabledLayers, onToggleLayer, onDependencyFilesFound, onAnalyzePackage, }) => {
    const { theme } = useTheme();
    const [dependencyLayers, setDependencyLayers] = useState([]);
    const [loadingDependencies, setLoadingDependencies] = useState(false);
    const [searchingDep, setSearchingDep] = useState(null);
    const [dependencyViewMode, setDependencyViewMode] = useState('byPackage');
    useEffect(() => {
        analyzeDependencies();
    }, [packageDirs]);
    const analyzeDependencies = async () => {
        setLoadingDependencies(true);
        const depLayers = [];
        try {
            // Collect all unique dependencies from all packages
            const allDependencies = new Map();
            packageDirs.forEach((pkg) => {
                const deps = {
                    ...pkg.dependencies,
                    ...pkg.devDependencies,
                    ...pkg.peerDependencies,
                };
                Object.entries(deps).forEach(([depName, version]) => {
                    if (!allDependencies.has(depName)) {
                        allDependencies.set(depName, {
                            packages: new Set(),
                            versions: new Map(),
                        });
                    }
                    const depInfo = allDependencies.get(depName);
                    depInfo.packages.add(pkg.name);
                    depInfo.versions.set(pkg.name, version);
                });
            });
            // Create dependency layers
            allDependencies.forEach((depInfo, depName) => {
                depLayers.push({
                    name: depName,
                    packageName: depName,
                    files: [], // Will be populated when enabled
                    color: getColorForDependency(depName),
                    enabled: false,
                    usedBy: Array.from(depInfo.packages),
                    versions: Object.fromEntries(depInfo.versions),
                });
            });
            // Sort by usage count
            depLayers.sort((a, b) => (b.usedBy?.length || 0) - (a.usedBy?.length || 0));
            setDependencyLayers(depLayers);
        }
        catch (error) {
            console.error('Failed to analyze dependencies:', error);
        }
        finally {
            setLoadingDependencies(false);
        }
    };
    const getColorForDependency = (depName) => {
        // Use a hash function to generate consistent colors
        let hash = 0;
        for (let i = 0; i < depName.length; i++) {
            hash = depName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    };
    const searchDependencyFiles = async (dep) => {
        if (dep.loading || dep.files.length > 0)
            return;
        setSearchingDep(dep.packageName);
        // Update the dependency to show loading state
        setDependencyLayers((prev) => prev.map((d) => d.packageName === dep.packageName ? { ...d, loading: true } : d));
        try {
            // Create search patterns for different import styles
            const patterns = [
                `import.*from\\s+['"]${dep.packageName}['"]`,
                `require\\s*\\(\\s*['"]${dep.packageName}['"]\\s*\\)`,
                `from\\s+${dep.packageName}\\s+import`, // Python
            ];
            const allFiles = new Set();
            // Search for each pattern using shell command (similar to working implementation)
            for (const pattern of patterns) {
                try {
                    // Use grep command to search for patterns in JavaScript/TypeScript files
                    const grepCommand = `grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.mjs" --include="*.cjs" -l "${pattern}" . 2>/dev/null || true`;
                    const result = await window.mainProcess.shell.runCommand(grepCommand, {
                        cwd: workingDirectory,
                    });
                    if (result && result.output) {
                        // Parse the output lines as file paths
                        const lines = result.output
                            .trim()
                            .split('\n')
                            .filter((line) => line.length > 0);
                        lines.forEach((filePath) => {
                            // Remove leading ./ if present
                            const cleanPath = filePath.startsWith('./')
                                ? filePath.substring(2)
                                : filePath;
                            if (cleanPath) {
                                allFiles.add(cleanPath);
                            }
                        });
                    }
                }
                catch (error) {
                    console.warn(`Failed to search for pattern ${pattern}:`, error);
                }
            }
            const files = Array.from(allFiles);
            // Update the dependency with found files
            setDependencyLayers((prev) => prev.map((d) => d.packageName === dep.packageName
                ? { ...d, files, loading: false, enabled: true }
                : d));
            // Notify parent
            if (onDependencyFilesFound) {
                onDependencyFilesFound(dep.packageName, files);
            }
        }
        catch (error) {
            console.error(`Failed to search files for ${dep.packageName}:`, error);
            setDependencyLayers((prev) => prev.map((d) => d.packageName === dep.packageName ? { ...d, loading: false } : d));
        }
        finally {
            setSearchingDep(null);
        }
    };
    const toggleDependency = async (dep) => {
        const layerId = `dep-layer-${dep.packageName}`;
        if (!dep.enabled && dep.files.length === 0) {
            // Need to search for files first
            await searchDependencyFiles(dep);
        }
        else {
            // Just toggle the enabled state
            setDependencyLayers((prev) => prev.map((d) => d.packageName === dep.packageName ? { ...d, enabled: !d.enabled } : d));
        }
        onToggleLayer(layerId);
    };
    const hasVersionConflict = (dep) => {
        if (!dep.versions)
            return false;
        const uniqueVersions = new Set(Object.values(dep.versions));
        return uniqueVersions.size > 1;
    };
    if (loadingDependencies) {
        return (_jsx("div", { style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: theme.colors.textSecondary,
            }, children: "Loading dependencies..." }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                }, children: [_jsx("h3", { style: {
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: '600',
                            color: theme.colors.text,
                        }, children: "Dependencies" }), _jsxs("div", { style: { display: 'flex', gap: '8px', alignItems: 'center' }, children: [_jsxs("span", { style: {
                                    fontSize: '13px',
                                    color: theme.colors.textSecondary,
                                }, children: [dependencyLayers.length, " dependencies"] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '4px',
                                    padding: '2px',
                                }, children: [_jsx("button", { onClick: () => setDependencyViewMode('flat'), style: {
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            backgroundColor: dependencyViewMode === 'flat'
                                                ? theme.colors.primary
                                                : 'transparent',
                                            color: dependencyViewMode === 'flat' ? 'white' : theme.colors.text,
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }, children: "All" }), _jsx("button", { onClick: () => setDependencyViewMode('byPackage'), style: {
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            backgroundColor: dependencyViewMode === 'byPackage'
                                                ? theme.colors.primary
                                                : 'transparent',
                                            color: dependencyViewMode === 'byPackage'
                                                ? 'white'
                                                : theme.colors.text,
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }, children: "By Package" })] })] })] }), dependencyViewMode === 'flat' ? (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '6px' }, children: dependencyLayers.map((dep) => {
                    const layerId = `dep-layer-${dep.packageName}`;
                    const isEnabled = enabledLayers.has(layerId) || dep.enabled;
                    return (_jsxs("div", { onClick: () => toggleDependency(dep), style: {
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px',
                            backgroundColor: theme.colors.backgroundLight,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            opacity: isEnabled ? 1 : 0.8,
                            border: `2px solid ${isEnabled ? dep.color : 'transparent'}`,
                        }, children: [_jsx("div", { style: {
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: dep.color,
                                    marginRight: '10px',
                                } }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: {
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            color: theme.colors.text,
                                        }, children: [dep.name, hasVersionConflict(dep) && (_jsx("span", { style: {
                                                    marginLeft: '8px',
                                                    padding: '1px 4px',
                                                    backgroundColor: '#ff980050',
                                                    color: '#ff9800',
                                                    borderRadius: '3px',
                                                    fontSize: '10px',
                                                }, children: "version conflict" }))] }), _jsxs("div", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                            marginTop: '2px',
                                        }, children: ["Used by ", dep.usedBy?.length || 0, " package", (dep.usedBy?.length || 0) !== 1 ? 's' : '', dep.files.length > 0 &&
                                                ` • ${dep.files.length} file${dep.files.length !== 1 ? 's' : ''}`] })] }), dep.loading && (_jsx("div", { style: {
                                    fontSize: '11px',
                                    color: theme.colors.primary,
                                }, children: "Searching..." })), _jsx("div", { style: {
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '3px',
                                    border: `2px solid ${isEnabled ? dep.color : theme.colors.border}`,
                                    backgroundColor: isEnabled ? dep.color : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: '8px',
                                }, children: isEnabled && !dep.loading && (_jsx("svg", { width: "10", height: "8", viewBox: "0 0 10 8", fill: "none", children: _jsx("path", { d: "M1 4L3 6L9 1", stroke: "white", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) })) })] }, dep.packageName));
                }) })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: packageDirs.map((pkg) => {
                    const pkgDeps = dependencyLayers.filter((dep) => dep.usedBy?.includes(pkg.name));
                    if (pkgDeps.length === 0)
                        return null;
                    return (_jsxs("div", { children: [_jsxs("div", { style: {
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: theme.colors.text,
                                    marginBottom: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }, children: [pkg.name, _jsxs("span", { style: {
                                                    fontSize: '11px',
                                                    color: theme.colors.textSecondary,
                                                    fontWeight: 'normal',
                                                }, children: [pkgDeps.length, " dependencies"] })] }), onAnalyzePackage && (_jsxs("button", { onClick: (e) => {
                                            e.stopPropagation();
                                            onAnalyzePackage(pkg);
                                        }, style: {
                                            padding: '4px 8px',
                                            fontSize: '10px',
                                            backgroundColor: theme.colors.primary,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }, children: [_jsx("span", { style: { fontSize: '10px' }, children: "\uD83D\uDD0D" }), "Analyze"] }))] }), _jsx("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    paddingLeft: '12px',
                                }, children: pkgDeps.map((dep) => {
                                    const layerId = `dep-layer-${dep.packageName}`;
                                    const isEnabled = enabledLayers.has(layerId) || dep.enabled;
                                    const version = dep.versions?.[pkg.name];
                                    return (_jsxs("div", { onClick: () => toggleDependency(dep), style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '8px',
                                            backgroundColor: theme.colors.backgroundLight,
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            opacity: isEnabled ? 1 : 0.8,
                                        }, children: [_jsx("div", { style: {
                                                    width: '6px',
                                                    height: '6px',
                                                    borderRadius: '50%',
                                                    backgroundColor: dep.color,
                                                    marginRight: '8px',
                                                } }), _jsx("span", { style: { flex: 1, color: theme.colors.text }, children: dep.name }), version && (_jsx("span", { style: {
                                                    fontSize: '10px',
                                                    color: theme.colors.textSecondary,
                                                    fontFamily: 'monospace',
                                                }, children: version })), dep.loading && (_jsx("span", { style: {
                                                    fontSize: '10px',
                                                    color: theme.colors.primary,
                                                    marginLeft: '8px',
                                                }, children: "..." }))] }, dep.packageName));
                                }) })] }, pkg.path));
                }) }))] }));
};
