import React from 'react';
import { useTheme } from 'themed-markdown';
import { Cpu, Info, AlertTriangle } from 'lucide-react';
import { SystemService } from '../../main-process-api/SystemService';

export interface MemoryInfo {
  totalMemory: number;
  freeMemory: number;
  cpus?: number;
  platform?: string;
  arch?: string;
}

interface MemoryWidgetProps {
  compact?: boolean;
  showWarning?: boolean;
  warningThreshold?: number; // Percentage (default 80)
  refreshInterval?: number; // in milliseconds, 0 to disable
  onMemoryChange?: (info: MemoryInfo) => void;
  cacheTimeout?: number; // Cache results for this many milliseconds (default: 1000)
}

// Shared memory cache - much shorter timeout since memory checks are cheap
let memoryCache: { data: MemoryInfo | null; timestamp: number } | null = null;

export const MemoryWidget: React.FC<MemoryWidgetProps> = ({
  compact = false,
  showWarning = true,
  warningThreshold = 80,
  refreshInterval = 0,
  onMemoryChange,
  cacheTimeout = 1000, // 1 second cache for memory (it's cheap to check)
}) => {
  const { theme } = useTheme();
  const [memoryInfo, setMemoryInfo] = React.useState<MemoryInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const checkMemory = React.useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && memoryCache && 
          Date.now() - memoryCache.timestamp < cacheTimeout) {
        setMemoryInfo(memoryCache.data);
        onMemoryChange?.(memoryCache.data!);
        setIsLoading(false);
        return;
      }
      
      // Get full system info but we'll only use memory data
      const info = await SystemService.getSystemInfo();
      if (info) {
        const memData: MemoryInfo = {
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
    } catch (error) {
      console.error('Error checking memory:', error);
      // Fallback data
      const fallback: MemoryInfo = {
        totalMemory: 16,
        freeMemory: 8,
      };
      setMemoryInfo(fallback);
    } finally {
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
        <Cpu size={14} style={{ color: isWarning ? theme.colors.warning : theme.colors.primary }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: theme.colors.text, fontWeight: 500 }}>
            {memoryInfo.freeMemory}GB
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
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${usagePercent}%`,
              backgroundColor: isWarning ? theme.colors.warning : theme.colors.primary,
              transition: 'width 0.3s',
            }}
          />
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
        <Cpu size={16} style={{ color: theme.colors.primary }} />
        Memory (RAM)
        {memoryInfo.cpus && (
          <span style={{ fontSize: '11px', opacity: 0.7 }}>
            • {memoryInfo.cpus} CPUs
          </span>
        )}
      </div>
      
      <div
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: isWarning ? theme.colors.warning : theme.colors.text,
          marginBottom: '4px',
        }}
      >
        {memoryInfo.freeMemory} GB available
      </div>
      
      <div
        style={{
          fontSize: '12px',
          color: theme.colors.textSecondary,
          marginBottom: '8px',
        }}
      >
        of {memoryInfo.totalMemory} GB total ({Math.round(usagePercent)}% used)
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
            width: `${usagePercent}%`,
            backgroundColor: isWarning ? theme.colors.warning : theme.colors.primary,
            transition: 'width 0.3s',
          }}
        />
      </div>

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
          High memory usage - consider closing some applications
        </div>
      )}
    </div>
  );
};

// Hook for just memory info
export const useMemoryInfo = (refreshInterval = 0, cacheTimeout = 1000) => {
  const [memoryInfo, setMemoryInfo] = React.useState<MemoryInfo | null>(null);
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
          const memData: MemoryInfo = {
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
      } catch (err) {
        console.error('Error getting memory info:', err);
      } finally {
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