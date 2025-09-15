import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useTheme } from 'themed-markdown';
import { Cpu, AlertTriangle } from 'lucide-react';
import { SystemService } from '../../main-process-api/SystemService';
// Shared memory cache - much shorter timeout since memory checks are cheap
let memoryCache = null;
export const MemoryWidget = ({ compact = false, showWarning = true, warningThreshold = 80, refreshInterval = 0, onMemoryChange, cacheTimeout = 1000, // 1 second cache for memory (it's cheap to check)
 }) => {
    const { theme } = useTheme();
    const [memoryInfo, setMemoryInfo] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const checkMemory = React.useCallback(async (forceRefresh = false) => {
        try {
            // Check cache first
            if (!forceRefresh && memoryCache &&
                Date.now() - memoryCache.timestamp < cacheTimeout) {
                setMemoryInfo(memoryCache.data);
                onMemoryChange?.(memoryCache.data);
                setIsLoading(false);
                return;
            }
            // Get full system info but we'll only use memory data
            const info = await SystemService.getSystemInfo();
            if (info) {
                const memData = {
                    totalMemory: info.totalMemory,
                    freeMemory: info.freeMemory,
                    cpus: info.cpus,
                    platform: info.platform,
                    arch: info.arch,
                };
                // Update cache
                memoryCache = { data: memData, timestamp: Date.now() };
                setMemoryInfo(memData);
                onMemoryChange?.(memData);
            }
        }
        catch (error) {
            console.error('Error checking memory:', error);
            // Fallback data
            const fallback = {
                totalMemory: 16,
                freeMemory: 8,
            };
            setMemoryInfo(fallback);
        }
        finally {
            setIsLoading(false);
        }
    }, [cacheTimeout, onMemoryChange]);
    React.useEffect(() => {
        checkMemory();
        if (refreshInterval > 0) {
            // Allow faster refresh for memory since it's cheap (minimum 1 second)
            const safeInterval = Math.max(refreshInterval, 1000);
            const interval = setInterval(() => checkMemory(true), safeInterval);
            return () => clearInterval(interval);
        }
    }, [checkMemory, refreshInterval]);
    if (isLoading && !memoryInfo) {
        return null;
    }
    if (!memoryInfo) {
        return null;
    }
    const usagePercent = ((memoryInfo.totalMemory - memoryInfo.freeMemory) / memoryInfo.totalMemory) * 100;
    const isWarning = showWarning && usagePercent > warningThreshold;
    if (compact) {
        // Inline compact view
        return (_jsxs("div", { style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '6px',
                border: `1px solid ${isWarning ? theme.colors.warning : theme.colors.border}`,
                fontSize: '12px',
            }, children: [_jsx(Cpu, { size: 14, style: { color: isWarning ? theme.colors.warning : theme.colors.primary } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsxs("span", { style: { color: theme.colors.text, fontWeight: 500 }, children: [memoryInfo.freeMemory, "GB"] }), _jsx("span", { style: { color: theme.colors.textSecondary }, children: "free" }), isWarning && (_jsx(AlertTriangle, { size: 12, style: { color: theme.colors.warning, marginLeft: '4px' } }))] }), _jsx("div", { style: {
                        width: '60px',
                        height: '4px',
                        backgroundColor: theme.colors.border,
                        borderRadius: '2px',
                        overflow: 'hidden',
                    }, children: _jsx("div", { style: {
                            height: '100%',
                            width: `${usagePercent}%`,
                            backgroundColor: isWarning ? theme.colors.warning : theme.colors.primary,
                            transition: 'width 0.3s',
                        } }) })] }));
    }
    // Full widget view
    return (_jsxs("div", { style: {
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
        }, children: [_jsxs("div", { style: {
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }, children: [_jsx(Cpu, { size: 16, style: { color: theme.colors.primary } }), "Memory (RAM)", memoryInfo.cpus && (_jsxs("span", { style: { fontSize: '11px', opacity: 0.7 }, children: ["\u2022 ", memoryInfo.cpus, " CPUs"] }))] }), _jsxs("div", { style: {
                    fontSize: '20px',
                    fontWeight: 600,
                    color: isWarning ? theme.colors.warning : theme.colors.text,
                    marginBottom: '4px',
                }, children: [memoryInfo.freeMemory, " GB available"] }), _jsxs("div", { style: {
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    marginBottom: '8px',
                }, children: ["of ", memoryInfo.totalMemory, " GB total (", Math.round(usagePercent), "% used)"] }), _jsx("div", { style: {
                    height: '6px',
                    backgroundColor: theme.colors.border,
                    borderRadius: '3px',
                    overflow: 'hidden',
                }, children: _jsx("div", { style: {
                        height: '100%',
                        width: `${usagePercent}%`,
                        backgroundColor: isWarning ? theme.colors.warning : theme.colors.primary,
                        transition: 'width 0.3s',
                    } }) }), isWarning && (_jsxs("div", { style: {
                    marginTop: '8px',
                    fontSize: '11px',
                    color: theme.colors.warning,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }, children: [_jsx(AlertTriangle, { size: 12 }), "High memory usage - consider closing some applications"] }))] }));
};
// Hook for just memory info
export const useMemoryInfo = (refreshInterval = 0, cacheTimeout = 1000) => {
    const [memoryInfo, setMemoryInfo] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    React.useEffect(() => {
        const checkMemory = async (forceRefresh = false) => {
            try {
                // Check cache first
                if (!forceRefresh && memoryCache &&
                    Date.now() - memoryCache.timestamp < cacheTimeout) {
                    setMemoryInfo(memoryCache.data);
                    setLoading(false);
                    return;
                }
                const info = await SystemService.getSystemInfo();
                if (info) {
                    const memData = {
                        totalMemory: info.totalMemory,
                        freeMemory: info.freeMemory,
                        cpus: info.cpus,
                        platform: info.platform,
                        arch: info.arch,
                    };
                    // Update cache
                    memoryCache = { data: memData, timestamp: Date.now() };
                    setMemoryInfo(memData);
                }
            }
            catch (err) {
                console.error('Error getting memory info:', err);
            }
            finally {
                setLoading(false);
            }
        };
        checkMemory();
        if (refreshInterval > 0) {
            const safeInterval = Math.max(refreshInterval, 1000);
            const interval = setInterval(() => checkMemory(true), safeInterval);
            return () => clearInterval(interval);
        }
    }, [refreshInterval, cacheTimeout]);
    return { memoryInfo, loading };
};
