/**
 * Hook for integrating violation monitoring with city visualization
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { violationMonitoringService } from '../services/ViolationMonitoringServiceIPC';
/**
 * Hook to monitor code violations and provide highlight layers for visualization
 */
export function useViolationMonitoring(source, packageLayers, // PackageLayer[] from core
options = {}) {
    const { enabled = true, includeTypescript = true, includeEslint = true, autoRefresh = false, refreshInterval = 60000, // 1 minute default
    useCache = true } = options;
    const [violationResult, setViolationResult] = useState(null);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [error, setError] = useState(null);
    const [tsEnabled, setTsEnabled] = useState(includeTypescript);
    const [eslintEnabled, setEslintEnabled] = useState(includeEslint);
    // Monitor violations
    const monitor = useCallback(async () => {
        if (!enabled || !source || !packageLayers || packageLayers.length === 0 || source.type !== 'local') {
            // Silently skip if conditions not met
            setViolationResult(null);
            return;
        }
        console.log('[useViolationMonitoring] Starting violation monitoring for:', {
            sourceLocation: source?.location,
            packageCount: packageLayers?.length
        });
        setIsMonitoring(true);
        setError(null);
        try {
            const monitoringOptions = {
                includeTypescript: tsEnabled,
                includeEslint: eslintEnabled,
                useCache,
                maxFilesToProcess: 500 // Limit for performance
            };
            const result = await violationMonitoringService.monitorViolations(source, packageLayers, monitoringOptions);
            setViolationResult(result);
            console.log(`[ViolationMonitoring] Found ${result.totalViolations} violations in ${result.totalPackages} packages`);
        }
        catch (err) {
            console.error('[ViolationMonitoring] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to monitor violations');
        }
        finally {
            setIsMonitoring(false);
        }
    }, [enabled, source, packageLayers, tsEnabled, eslintEnabled, useCache]);
    // Auto-refresh only (no initial monitoring unless explicitly enabled)
    useEffect(() => {
        // Only set up auto-refresh if explicitly enabled and already has results
        if (enabled && autoRefresh && violationResult && source && packageLayers) {
            const interval = setInterval(monitor, refreshInterval);
            return () => {
                clearInterval(interval);
                // Cancel any ongoing monitoring when unmounting
                if (source) {
                    violationMonitoringService.cancelMonitoring(source.id);
                }
            };
        }
        return () => {
            // Cancel any ongoing monitoring when unmounting
            if (source) {
                violationMonitoringService.cancelMonitoring(source.id);
            }
        };
    }, [enabled, source, packageLayers, autoRefresh, refreshInterval, monitor, violationResult]);
    // Convert result to highlight layer
    const violationLayer = useMemo(() => {
        if (!violationResult || violationResult.totalViolations === 0) {
            return null;
        }
        const items = [];
        // Convert file violations from all packages to layer items
        for (const pkg of violationResult.packages) {
            for (const [relativePath, fileViolations] of pkg.fileViolations) {
                // Determine color based on severity
                let color;
                let opacity;
                if (fileViolations.errorCount > 0) {
                    color = '#ef4444'; // red
                    opacity = Math.min(0.3 + (fileViolations.errorCount * 0.05), 0.6);
                }
                else if (fileViolations.warningCount > 0) {
                    color = '#f59e0b'; // amber
                    opacity = Math.min(0.2 + (fileViolations.warningCount * 0.03), 0.4);
                }
                else {
                    color = '#3b82f6'; // blue
                    opacity = 0.2;
                }
                // Include package path in the file path if it's not the root package
                const fullPath = pkg.packagePath && pkg.packagePath !== '.' && pkg.packagePath !== ''
                    ? `${pkg.packagePath}/${relativePath}`
                    : relativePath;
                items.push({
                    path: fullPath,
                    type: 'file',
                    renderStrategy: 'fill',
                    coverOptions: {
                        opacity,
                        backgroundColor: color,
                        borderRadius: 2
                    }
                });
            }
        }
        return {
            id: 'violations',
            name: `Code Violations (${violationResult.totalErrors}E/${violationResult.totalWarnings}W in ${violationResult.totalPackages} packages)`,
            enabled: true,
            color: '#ef4444', // Default to error color
            opacity: 0.5,
            borderWidth: 2,
            priority: 100, // High priority to show on top
            items,
            dynamic: true // Mark as dynamic since violations change frequently
        };
    }, [violationResult]);
    // Toggle functions
    const toggleTypeScript = useCallback(() => {
        setTsEnabled(prev => !prev);
        if (source) {
            violationMonitoringService.clearCache(source.id);
        }
    }, [source]);
    const toggleESLint = useCallback(() => {
        setEslintEnabled(prev => !prev);
        if (source) {
            violationMonitoringService.clearCache(source.id);
        }
    }, [source]);
    // Refresh function
    const refresh = useCallback(() => {
        if (source) {
            violationMonitoringService.clearCache(source.id);
        }
        monitor();
    }, [source, monitor]);
    // Get summary for a specific file
    const getSummaryForFile = useCallback((filePath) => {
        if (!violationResult)
            return null;
        return violationMonitoringService.getFileSummary(violationResult, filePath);
    }, [violationResult]);
    return {
        violationResult,
        violationLayer,
        isMonitoring,
        error,
        refresh,
        toggleTypeScript,
        toggleESLint,
        getSummaryForFile
    };
}
