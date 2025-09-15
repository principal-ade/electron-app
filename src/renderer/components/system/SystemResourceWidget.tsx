import React from 'react';
import { useTheme } from 'themed-markdown';
import { HardDrive, Cpu, Info, AlertTriangle } from 'lucide-react';
import { SystemService } from '../../main-process-api/SystemService';

export interface SystemInfo {
  totalMemory: number;
  freeMemory: number;
  totalDisk: number;
  freeDisk: number;
  platform: string;
  arch: string;
  cpus?: number;
  osVersion?: string;
}

interface SystemResourceWidgetProps {
  showMemory?: boolean;
  showDisk?: boolean;
  showRecommendations?: boolean;
  compact?: boolean;
  refreshInterval?: number; // in milliseconds, 0 to disable. Minimum 5000ms to avoid excessive polling
  onSystemInfoChange?: (info: SystemInfo) => void;
  additionalDiskUsage?: { label: string; sizeGB: number; color?: string }[];
  cacheTimeout?: number; // Cache results for this many milliseconds (default: 5000)
}

// Shared cache across all widget instances
let systemInfoCache: { data: SystemInfo | null; timestamp: number } | null = null;

export const SystemResourceWidget: React.FC<SystemResourceWidgetProps> = ({
  showMemory = true,
  showDisk = true,
  showRecommendations = false,
  compact = false,
  refreshInterval = 0,
  onSystemInfoChange,
  additionalDiskUsage = [],
  cacheTimeout = 5000, // Default 5 second cache
}) => {
  const { theme } = useTheme();
  const [systemInfo, setSystemInfo] = React.useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const checkSystemInfo = React.useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && systemInfoCache && 
          Date.now() - systemInfoCache.timestamp < cacheTimeout) {
        setSystemInfo(systemInfoCache.data);
        onSystemInfoChange?.(systemInfoCache.data!);
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
      } else {
        setError('Failed to get system information');
        // Fallback to placeholder data
        const fallbackInfo: SystemInfo = {
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
    } catch (err) {
      console.error('Error checking system info:', err);
      setError('Error loading system information');
      // Fallback to placeholder data
      const fallbackInfo: SystemInfo = {
        totalMemory: 16,
        freeMemory: 8,
        totalDisk: 500,
        freeDisk: 150,
        platform: 'unknown',
        arch: 'unknown',
      };
      setSystemInfo(fallbackInfo);
      onSystemInfoChange?.(fallbackInfo);
    } finally {
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
    return (
      <div
        style={{
          padding: compact ? '16px' : '24px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          border: `1px solid ${theme.colors.border}`,
          textAlign: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        Loading system information...
      </div>
    );
  }

  if (!systemInfo) {
    return null;
  }

  const totalAdditionalDiskUsage = additionalDiskUsage.reduce(
    (sum, item) => sum + item.sizeGB,
    0
  );

  const memoryUsagePercent = ((systemInfo.totalMemory - systemInfo.freeMemory) / systemInfo.totalMemory) * 100;
  const diskUsagePercent = ((systemInfo.totalDisk - systemInfo.freeDisk) / systemInfo.totalDisk) * 100;
  
  // Warning thresholds
  const memoryWarning = memoryUsagePercent > 80;
  const diskWarning = diskUsagePercent > 90;

  if (compact) {
    // Compact inline view
    return (
      <div
        style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          fontSize: '13px',
        }}
      >
        {showMemory && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} style={{ color: theme.colors.primary }} />
            <div>
              <span style={{ color: theme.colors.text, fontWeight: 500 }}>
                {systemInfo.freeMemory}GB
              </span>
              <span style={{ color: theme.colors.textSecondary }}> / {systemInfo.totalMemory}GB RAM</span>
              {memoryWarning && (
                <AlertTriangle
                  size={12}
                  style={{ color: theme.colors.warning, marginLeft: '4px' }}
                />
              )}
            </div>
          </div>
        )}
        
        {showDisk && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={16} style={{ color: theme.colors.primary }} />
            <div>
              <span style={{ color: theme.colors.text, fontWeight: 500 }}>
                {systemInfo.freeDisk}GB
              </span>
              <span style={{ color: theme.colors.textSecondary }}> / {systemInfo.totalDisk}GB Disk</span>
              {diskWarning && (
                <AlertTriangle
                  size={12}
                  style={{ color: theme.colors.warning, marginLeft: '4px' }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full widget view
  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '12px',
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      <h3
        style={{
          margin: '0 0 16px 0',
          fontSize: '16px',
          fontWeight: 600,
          color: theme.colors.text,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <HardDrive size={20} />
        System Resources
      </h3>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: `${theme.colors.warning}20`,
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: theme.colors.warning,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Memory Info */}
      {showMemory && (
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Memory (RAM)
            <Info
              size={14}
              style={{ opacity: 0.6, cursor: 'help' }}
              title="Memory currently available for applications"
            />
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: memoryWarning ? theme.colors.warning : theme.colors.text,
              marginBottom: '4px',
            }}
          >
            {systemInfo.freeMemory} GB available
          </div>
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}
          >
            of {systemInfo.totalMemory} GB total
            {systemInfo.cpus && ` • ${systemInfo.cpus} CPUs`}
          </div>
          <div
            style={{
              height: '6px',
              backgroundColor: theme.colors.border,
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${memoryUsagePercent}%`,
                backgroundColor: memoryWarning ? theme.colors.warning : theme.colors.primary,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Disk Space Info */}
      {showDisk && (
        <div style={{ marginBottom: showRecommendations ? '20px' : 0 }}>
          <div
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}
          >
            Disk Space
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: diskWarning ? theme.colors.warning : theme.colors.text,
              marginBottom: '4px',
            }}
          >
            {systemInfo.freeDisk} GB free
          </div>
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}
          >
            of {systemInfo.totalDisk} GB total
            {totalAdditionalDiskUsage > 0 && (
              <span>
                {' • '}
                {additionalDiskUsage.map((item, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    {Math.round(item.sizeGB)} GB {item.label}
                  </span>
                ))}
              </span>
            )}
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: theme.colors.border,
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {/* System usage */}
            <div
              style={{
                height: '100%',
                width: `${((systemInfo.totalDisk - systemInfo.freeDisk - totalAdditionalDiskUsage) / systemInfo.totalDisk) * 100}%`,
                backgroundColor: theme.colors.textTertiary,
                transition: 'width 0.3s',
              }}
            />
            {/* Additional usage segments */}
            {additionalDiskUsage.map((item, i) => (
              <div
                key={i}
                style={{
                  height: '100%',
                  width: `${(item.sizeGB / systemInfo.totalDisk) * 100}%`,
                  backgroundColor: item.color || theme.colors.primary,
                  transition: 'width 0.3s',
                }}
              />
            ))}
          </div>
          
          {/* Legend for disk usage */}
          {additionalDiskUsage.length > 0 && (
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                gap: '16px',
                fontSize: '11px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    backgroundColor: theme.colors.textTertiary,
                  }}
                />
                <span style={{ color: theme.colors.textSecondary }}>System</span>
              </div>
              {additionalDiskUsage.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      backgroundColor: item.color || theme.colors.primary,
                    }}
                  />
                  <span style={{ color: theme.colors.textSecondary }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {showRecommendations && (
        <div
          style={{
            padding: '16px',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}
          >
            System Status
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            {memoryWarning && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: '8px',
                  marginBottom: '8px',
                  color: theme.colors.warning,
                }}
              >
                <AlertTriangle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>Low memory available. Consider closing some applications.</span>
              </div>
            )}
            {diskWarning && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: '8px',
                  marginBottom: '8px',
                  color: theme.colors.warning,
                }}
              >
                <AlertTriangle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>Low disk space. Consider freeing up some space.</span>
              </div>
            )}
            {!memoryWarning && !diskWarning && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: theme.colors.success,
                }}
              >
                <Info size={14} />
                <span>System resources are healthy</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Export a hook for easy access to system info
export const useSystemInfo = (refreshInterval = 0, cacheTimeout = 5000) => {
  const [systemInfo, setSystemInfo] = React.useState<SystemInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get system info');
      } finally {
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