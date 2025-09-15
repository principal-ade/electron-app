import React from 'react';
import { useTheme } from 'themed-markdown';
import { HardDrive, AlertTriangle, Info } from 'lucide-react';
import { SystemService } from '../../main-process-api/SystemService';

export interface DiskInfo {
  totalDisk: number;
  freeDisk: number;
}

interface DiskSpaceWidgetProps {
  compact?: boolean;
  showWarning?: boolean;
  warningThreshold?: number; // Percentage (default 90)
  refreshInterval?: number; // in milliseconds, 0 to disable (minimum 10 seconds)
  onDiskChange?: (info: DiskInfo) => void;
  additionalUsage?: { label: string; sizeGB: number; color?: string }[];
  cacheTimeout?: number; // Cache results for this many milliseconds (default: 30000)
}

// Shared disk cache - longer timeout since disk checks are expensive
let diskCache: { data: DiskInfo | null; timestamp: number } | null = null;

export const DiskSpaceWidget: React.FC<DiskSpaceWidgetProps> = ({
  compact = false,
  showWarning = true,
  warningThreshold = 90,
  refreshInterval = 0,
  onDiskChange,
  additionalUsage = [],
  cacheTimeout = 30000, // 30 second cache for disk (it's expensive to check)
}) => {
  const { theme } = useTheme();
  const [diskInfo, setDiskInfo] = React.useState<DiskInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const checkDisk = React.useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && diskCache && 
          Date.now() - diskCache.timestamp < cacheTimeout) {
        setDiskInfo(diskCache.data);
        onDiskChange?.(diskCache.data!);
        setIsLoading(false);
        return;
      }
      
      // Get full system info but we'll only use disk data
      const info = await SystemService.getSystemInfo();
      if (info) {
        const diskData: DiskInfo = {
          totalDisk: info.totalDisk,
          freeDisk: info.freeDisk,
        };
        
        // Update cache
        diskCache = { data: diskData, timestamp: Date.now() };
        setDiskInfo(diskData);
        onDiskChange?.(diskData);
      }
    } catch (error) {
      console.error('Error checking disk space:', error);
      // Fallback data
      const fallback: DiskInfo = {
        totalDisk: 500,
        freeDisk: 150,
      };
      setDiskInfo(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [cacheTimeout, onDiskChange]);

  React.useEffect(() => {
    checkDisk();

    if (refreshInterval > 0) {
      // Enforce minimum 10 second interval for disk checks (they're expensive)
      const safeInterval = Math.max(refreshInterval, 10000);
      const interval = setInterval(() => checkDisk(true), safeInterval);
      return () => clearInterval(interval);
    }
  }, [checkDisk, refreshInterval]);

  if (isLoading && !diskInfo) {
    return null;
  }

  if (!diskInfo) {
    return null;
  }

  const totalAdditionalUsage = additionalUsage.reduce((sum, item) => sum + item.sizeGB, 0);
  const usagePercent = ((diskInfo.totalDisk - diskInfo.freeDisk) / diskInfo.totalDisk) * 100;
  const isWarning = showWarning && usagePercent > warningThreshold;

  if (compact) {
    // Inline compact view
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '6px',
          border: `1px solid ${isWarning ? theme.colors.warning : theme.colors.border}`,
          fontSize: '12px',
        }}
      >
        <HardDrive size={14} style={{ color: isWarning ? theme.colors.warning : theme.colors.primary }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: theme.colors.text, fontWeight: 500 }}>
            {diskInfo.freeDisk}GB
          </span>
          <span style={{ color: theme.colors.textSecondary }}>free</span>
          {isWarning && (
            <AlertTriangle size={12} style={{ color: theme.colors.warning, marginLeft: '4px' }} />
          )}
        </div>
        <div
          style={{
            width: '60px',
            height: '4px',
            backgroundColor: theme.colors.border,
            borderRadius: '2px',
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${((diskInfo.totalDisk - diskInfo.freeDisk - totalAdditionalUsage) / diskInfo.totalDisk) * 100}%`,
              backgroundColor: theme.colors.textTertiary,
            }}
          />
          {additionalUsage.map((item, i) => (
            <div
              key={i}
              style={{
                height: '100%',
                width: `${(item.sizeGB / diskInfo.totalDisk) * 100}%`,
                backgroundColor: item.color || theme.colors.primary,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Full widget view
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
      }}
    >
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
        <HardDrive size={16} style={{ color: theme.colors.primary }} />
        Disk Space
        <Info
          size={12}
          style={{ opacity: 0.5, cursor: 'help' }}
          title="Disk checks are cached for 30 seconds to reduce system load"
        />
      </div>
      
      <div
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: isWarning ? theme.colors.warning : theme.colors.text,
          marginBottom: '4px',
        }}
      >
        {diskInfo.freeDisk} GB free
      </div>
      
      <div
        style={{
          fontSize: '12px',
          color: theme.colors.textSecondary,
          marginBottom: '8px',
        }}
      >
        of {diskInfo.totalDisk} GB total
        {totalAdditionalUsage > 0 && (
          <span>
            {' • '}
            {additionalUsage.map((item, i) => (
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
            width: `${((diskInfo.totalDisk - diskInfo.freeDisk - totalAdditionalUsage) / diskInfo.totalDisk) * 100}%`,
            backgroundColor: theme.colors.textTertiary,
            transition: 'width 0.3s',
          }}
        />
        {/* Additional usage segments */}
        {additionalUsage.map((item, i) => (
          <div
            key={i}
            style={{
              height: '100%',
              width: `${(item.sizeGB / diskInfo.totalDisk) * 100}%`,
              backgroundColor: item.color || theme.colors.primary,
              transition: 'width 0.3s',
            }}
          />
        ))}
      </div>

      {/* Legend for multiple segments */}
      {additionalUsage.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            gap: '12px',
            fontSize: '11px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '2px',
                backgroundColor: theme.colors.textTertiary,
              }}
            />
            <span style={{ color: theme.colors.textSecondary }}>System</span>
          </div>
          {additionalUsage.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  backgroundColor: item.color || theme.colors.primary,
                }}
              />
              <span style={{ color: theme.colors.textSecondary }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {isWarning && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: theme.colors.warning,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertTriangle size={12} />
          Low disk space - consider freeing up some space
        </div>
      )}
    </div>
  );
};

// Hook for just disk info
export const useDiskInfo = (refreshInterval = 0, cacheTimeout = 30000) => {
  const [diskInfo, setDiskInfo] = React.useState<DiskInfo | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkDisk = async (forceRefresh = false) => {
      try {
        // Check cache first
        if (!forceRefresh && diskCache && 
            Date.now() - diskCache.timestamp < cacheTimeout) {
          setDiskInfo(diskCache.data);
          setLoading(false);
          return;
        }
        
        const info = await SystemService.getSystemInfo();
        if (info) {
          const diskData: DiskInfo = {
            totalDisk: info.totalDisk,
            freeDisk: info.freeDisk,
          };
          
          // Update cache
          diskCache = { data: diskData, timestamp: Date.now() };
          setDiskInfo(diskData);
        }
      } catch (err) {
        console.error('Error getting disk info:', err);
      } finally {
        setLoading(false);
      }
    };

    checkDisk();

    if (refreshInterval > 0) {
      const safeInterval = Math.max(refreshInterval, 10000);
      const interval = setInterval(() => checkDisk(true), safeInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, cacheTimeout]);

  return { diskInfo, loading };
};