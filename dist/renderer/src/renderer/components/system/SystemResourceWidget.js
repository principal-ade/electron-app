import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useTheme } from 'themed-markdown';
import { HardDrive, Cpu, Info, AlertTriangle } from 'lucide-react';
import { SystemService } from '../../main-process-api/SystemService';
// Shared cache across all widget instances
let systemInfoCache = null;
export const SystemResourceWidget = ({ showMemory = true, showDisk = true, showRecommendations = false, compact = false, refreshInterval = 0, onSystemInfoChange, additionalDiskUsage = [], cacheTimeout = 5000, // Default 5 second cache
 }) => {
    const { theme } = useTheme();
    const [systemInfo, setSystemInfo] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const checkSystemInfo = React.useCallback(async (forceRefresh = false) => {
        try {
            // Check cache first
            if (!forceRefresh && systemInfoCache &&
                Date.now() - systemInfoCache.timestamp < cacheTimeout) {
                setSystemInfo(systemInfoCache.data);
                onSystemInfoChange?.(systemInfoCache.data);
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            const info = await SystemService.getSystemInfo();
            if (info) {
                // Update cache
                systemInfoCache = { data: info, timestamp: Date.now() };
                setSystemInfo(info);
                onSystemInfoChange?.(info);
            }
            else {
                setError('Failed to get system information');
                // Fallback to placeholder data
                const fallbackInfo = {
                    totalMemory: 16,
                    freeMemory: 8,
                    totalDisk: 500,
                    freeDisk: 150,
                    platform: 'unknown',
                    arch: 'unknown',
                };
                setSystemInfo(fallbackInfo);
                onSystemInfoChange?.(fallbackInfo);
            }
        }
        catch (err) {
            console.error('Error checking system info:', err);
            setError('Error loading system information');
            // Fallback to placeholder data
            const fallbackInfo = {
                totalMemory: 16,
                freeMemory: 8,
                totalDisk: 500,
                freeDisk: 150,
                platform: 'unknown',
                arch: 'unknown',
            };
            setSystemInfo(fallbackInfo);
            onSystemInfoChange?.(fallbackInfo);
        }
        finally {
            setIsLoading(false);
        }
    }, [onSystemInfoChange]);
    React.useEffect(() => {
        checkSystemInfo();
        if (refreshInterval > 0) {
            // Enforce minimum interval of 5 seconds to avoid excessive polling
            const safeInterval = Math.max(refreshInterval, 5000);
            const interval = setInterval(() => checkSystemInfo(true), safeInterval);
            return () => clearInterval(interval);
        }
    }, [checkSystemInfo, refreshInterval]);
    if (isLoading && !systemInfo) {
        return (_jsx("div", { style: {
                padding: compact ? '16px' : '24px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '12px',
                border: `1px solid ${theme.colors.border}`,
                textAlign: 'center',
                color: theme.colors.textSecondary,
            }, children: "Loading system information..." }));
    }
    if (!systemInfo) {
        return null;
    }
    const totalAdditionalDiskUsage = additionalDiskUsage.reduce((sum, item) => sum + item.sizeGB, 0);
    const memoryUsagePercent = ((systemInfo.totalMemory - systemInfo.freeMemory) / systemInfo.totalMemory) * 100;
    const diskUsagePercent = ((systemInfo.totalDisk - systemInfo.freeDisk) / systemInfo.totalDisk) * 100;
    // Warning thresholds
    const memoryWarning = memoryUsagePercent > 80;
    const diskWarning = diskUsagePercent > 90;
    if (compact) {
        // Compact inline view
        return (_jsxs("div", { style: {
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                fontSize: '13px',
            }, children: [showMemory && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Cpu, { size: 16, style: { color: theme.colors.primary } }), _jsxs("div", { children: [_jsxs("span", { style: { color: theme.colors.text, fontWeight: 500 }, children: [systemInfo.freeMemory, "GB"] }), _jsxs("span", { style: { color: theme.colors.textSecondary }, children: [" / ", systemInfo.totalMemory, "GB RAM"] }), memoryWarning && (_jsx(AlertTriangle, { size: 12, style: { color: theme.colors.warning, marginLeft: '4px' } }))] })] })), showDisk && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(HardDrive, { size: 16, style: { color: theme.colors.primary } }), _jsxs("div", { children: [_jsxs("span", { style: { color: theme.colors.text, fontWeight: 500 }, children: [systemInfo.freeDisk, "GB"] }), _jsxs("span", { style: { color: theme.colors.textSecondary }, children: [" / ", systemInfo.totalDisk, "GB Disk"] }), diskWarning && (_jsx(AlertTriangle, { size: 12, style: { color: theme.colors.warning, marginLeft: '4px' } }))] })] }))] }));
    }
    // Full widget view
    return (_jsxs("div", { style: {
            padding: '24px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
        }, children: [_jsxs("h3", { style: {
                    margin: '0 0 16px 0',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }, children: [_jsx(HardDrive, { size: 20 }), "System Resources"] }), error && (_jsxs("div", { style: {
                    padding: '8px 12px',
                    backgroundColor: `${theme.colors.warning}20`,
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: theme.colors.warning,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }, children: [_jsx(AlertTriangle, { size: 14 }), error] })), showMemory && (_jsxs("div", { style: { marginBottom: '20px' }, children: [_jsxs("div", { style: {
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }, children: ["Memory (RAM)", _jsx(Info, { size: 14, style: { opacity: 0.6, cursor: 'help' }, title: "Memory currently available for applications" })] }), _jsxs("div", { style: {
                            fontSize: '20px',
                            fontWeight: 600,
                            color: memoryWarning ? theme.colors.warning : theme.colors.text,
                            marginBottom: '4px',
                        }, children: [systemInfo.freeMemory, " GB available"] }), _jsxs("div", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            marginBottom: '8px',
                        }, children: ["of ", systemInfo.totalMemory, " GB total", systemInfo.cpus && ` • ${systemInfo.cpus} CPUs`] }), _jsx("div", { style: {
                            height: '6px',
                            backgroundColor: theme.colors.border,
                            borderRadius: '3px',
                            overflow: 'hidden',
                        }, children: _jsx("div", { style: {
                                height: '100%',
                                width: `${memoryUsagePercent}%`,
                                backgroundColor: memoryWarning ? theme.colors.warning : theme.colors.primary,
                                transition: 'width 0.3s',
                            } }) })] })), showDisk && (_jsxs("div", { style: { marginBottom: showRecommendations ? '20px' : 0 }, children: [_jsx("div", { style: {
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            marginBottom: '8px',
                        }, children: "Disk Space" }), _jsxs("div", { style: {
                            fontSize: '20px',
                            fontWeight: 600,
                            color: diskWarning ? theme.colors.warning : theme.colors.text,
                            marginBottom: '4px',
                        }, children: [systemInfo.freeDisk, " GB free"] }), _jsxs("div", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            marginBottom: '8px',
                        }, children: ["of ", systemInfo.totalDisk, " GB total", totalAdditionalDiskUsage > 0 && (_jsxs("span", { children: [' • ', additionalDiskUsage.map((item, i) => (_jsxs("span", { children: [i > 0 && ', ', Math.round(item.sizeGB), " GB ", item.label] }, i)))] }))] }), _jsxs("div", { style: {
                            height: '8px',
                            backgroundColor: theme.colors.border,
                            borderRadius: '4px',
                            overflow: 'hidden',
                            display: 'flex',
                        }, children: [_jsx("div", { style: {
                                    height: '100%',
                                    width: `${((systemInfo.totalDisk - systemInfo.freeDisk - totalAdditionalDiskUsage) / systemInfo.totalDisk) * 100}%`,
                                    backgroundColor: theme.colors.textTertiary,
                                    transition: 'width 0.3s',
                                } }), additionalDiskUsage.map((item, i) => (_jsx("div", { style: {
                                    height: '100%',
                                    width: `${(item.sizeGB / systemInfo.totalDisk) * 100}%`,
                                    backgroundColor: item.color || theme.colors.primary,
                                    transition: 'width 0.3s',
                                } }, i)))] }), additionalDiskUsage.length > 0 && (_jsxs("div", { style: {
                            marginTop: '8px',
                            display: 'flex',
                            gap: '16px',
                            fontSize: '11px',
                            flexWrap: 'wrap',
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx("div", { style: {
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '2px',
                                            backgroundColor: theme.colors.textTertiary,
                                        } }), _jsx("span", { style: { color: theme.colors.textSecondary }, children: "System" })] }), additionalDiskUsage.map((item, i) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx("div", { style: {
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '2px',
                                            backgroundColor: item.color || theme.colors.primary,
                                        } }), _jsx("span", { style: { color: theme.colors.textSecondary }, children: item.label })] }, i)))] }))] })), showRecommendations && (_jsxs("div", { style: {
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '8px',
                }, children: [_jsx("div", { style: {
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            marginBottom: '8px',
                        }, children: "System Status" }), _jsxs("div", { style: { fontSize: '13px', lineHeight: 1.6 }, children: [memoryWarning && (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'start',
                                    gap: '8px',
                                    marginBottom: '8px',
                                    color: theme.colors.warning,
                                }, children: [_jsx(AlertTriangle, { size: 14, style: { marginTop: '2px', flexShrink: 0 } }), _jsx("span", { children: "Low memory available. Consider closing some applications." })] })), diskWarning && (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'start',
                                    gap: '8px',
                                    marginBottom: '8px',
                                    color: theme.colors.warning,
                                }, children: [_jsx(AlertTriangle, { size: 14, style: { marginTop: '2px', flexShrink: 0 } }), _jsx("span", { children: "Low disk space. Consider freeing up some space." })] })), !memoryWarning && !diskWarning && (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: theme.colors.success,
                                }, children: [_jsx(Info, { size: 14 }), _jsx("span", { children: "System resources are healthy" })] }))] })] }))] }));
};
// Export a hook for easy access to system info
export const useSystemInfo = (refreshInterval = 0, cacheTimeout = 5000) => {
    const [systemInfo, setSystemInfo] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        const checkInfo = async (forceRefresh = false) => {
            try {
                // Check cache first
                if (!forceRefresh && systemInfoCache &&
                    Date.now() - systemInfoCache.timestamp < cacheTimeout) {
                    setSystemInfo(systemInfoCache.data);
                    setLoading(false);
                    return;
                }
                setLoading(true);
                const info = await SystemService.getSystemInfo();
                // Update cache
                if (info) {
                    systemInfoCache = { data: info, timestamp: Date.now() };
                }
                setSystemInfo(info);
                setError(null);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to get system info');
            }
            finally {
                setLoading(false);
            }
        };
        checkInfo();
        if (refreshInterval > 0) {
            // Enforce minimum interval of 5 seconds
            const safeInterval = Math.max(refreshInterval, 5000);
            const interval = setInterval(() => checkInfo(true), safeInterval);
            return () => clearInterval(interval);
        }
    }, [refreshInterval, cacheTimeout]);
    return { systemInfo, loading, error };
};
