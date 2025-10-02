# Simple Resource Monitoring Panel

## Overview
Basic monitoring panel for repository-monitoring process showing:
- Registered repository directories
- Memory usage with history
- CPU usage with history

## Implementation

### 1. IPC Events (Following Codebase Conventions)

Create new event enum file:
```typescript
// src/shared/ipc-events/MonitoringEvents.ts
export enum MonitoringEvent {
  GET_MONITORING_STATUS = 'monitoring:get-status',
  START_MONITORING = 'monitoring:start',
  STOP_MONITORING = 'monitoring:stop',
  // For future event monitoring expansion
  GET_EVENT_METRICS = 'monitoring:get-event-metrics',
}
```

### 2. Backend API

```typescript
// src/main/repository-monitoring/RepositoryMonitoringManager.ts

interface ResourceSnapshot {
  timestamp: number;
  memory: number;  // RSS in bytes
  cpu: number;     // Percentage 0-100
}

interface MonitoringStatus {
  repositories: string[];  // List of registered paths
  currentMemory: number;
  currentCpu: number;
  history: ResourceSnapshot[];  // Last 30 snapshots
}

async getMonitoringStatus(): Promise<MonitoringStatus> {
  return this.sendRequest({
    type: 'get-monitoring-status',
    requestId: uuidv4()
  });
}
```

### 3. IPC Handler Setup

```typescript
// src/main/repository-monitoring/ipcHandlers.ts

import { ipcMain } from 'electron';
import { MonitoringEvent } from '../../shared/ipc-events/MonitoringEvents';

export function setupMonitoringHandlers(manager: RepositoryMonitoringManager) {
  ipcMain.handle(MonitoringEvent.GET_MONITORING_STATUS, async () => {
    return manager.getMonitoringStatus();
  });
}
```

### 4. Frontend Service

```typescript
// src/renderer/main-process-api/RepositoryMonitoringService.ts

export class RepositoryMonitoringService {
  async getMonitoringStatus(): Promise<MonitoringStatus> {
    return window.api.repositoryMonitoring.getMonitoringStatus();
  }
}
```

### 5. UI Component with Theme Integration

```typescript
// src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx

import React, { useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Activity, HardDrive } from 'lucide-react';
import './SystemMonitor.css';

interface MonitoringStatus {
  repositories: string[];
  currentMemory: number;
  currentCpu: number;
  history: ResourceSnapshot[];
}

export const SystemMonitor: React.FC<{ sidebarCollapsed?: boolean }> = ({ sidebarCollapsed }) => {
  const { theme, colorMode } = useTheme();
  const [status, setStatus] = useState<MonitoringStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const service = new RepositoryMonitoringService();
      const data = await service.getMonitoringStatus();
      setStatus(data);
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return (
      <div style={{ padding: 20, color: theme.colors.text }}>
        Loading monitoring data...
      </div>
    );
  }

  // Simple sparkline component
  const Sparkline: React.FC<{ data: number[], max?: number }> = ({ data, max = 100 }) => {
    const width = 120;
    const height = 30;
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (val / max) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke={theme.colors.primary}
          strokeWidth="2"
        />
      </svg>
    );
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb < 1000 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div
      className="system-monitor"
      style={{
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div className="monitor-header" style={{
        padding: '20px',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 600,
          margin: 0,
          fontFamily: theme.fonts.heading,
        }}>
          Repository Monitoring
        </h2>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Registered Repositories */}
        <section style={{ marginBottom: '30px' }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: theme.colors.textSecondary,
            marginBottom: '12px',
            fontFamily: theme.fonts.heading,
          }}>
            REGISTERED DIRECTORIES ({status.repositories.length})
          </h3>
          <div style={{
            backgroundColor: colorMode === 'dark'
              ? theme.colors.modes?.dark?.backgroundSecondary
              : theme.colors.backgroundSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
          }}>
            {status.repositories.length === 0 ? (
              <div style={{ padding: '16px', color: theme.colors.textSecondary }}>
                No repositories registered
              </div>
            ) : (
              status.repositories.map((repo, index) => (
                <div
                  key={repo}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: index < status.repositories.length - 1
                      ? `1px solid ${theme.colors.border}`
                      : 'none',
                  }}
                >
                  <span style={{ marginRight: '8px' }}>📁</span>
                  <span style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: '13px',
                  }}>
                    {repo}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Resource Metrics */}
        <section>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: theme.colors.textSecondary,
            marginBottom: '12px',
            fontFamily: theme.fonts.heading,
          }}>
            RESOURCE USAGE
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}>
            {/* Memory Card */}
            <div style={{
              backgroundColor: colorMode === 'dark'
                ? theme.colors.modes?.dark?.backgroundSecondary
                : theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '16px',
              border: `1px solid ${theme.colors.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <HardDrive size={16} style={{ marginRight: '6px', color: theme.colors.primary }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>MEMORY</span>
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '12px',
                fontFamily: theme.fonts.mono,
              }}>
                {formatBytes(status.currentMemory)}
              </div>
              <Sparkline
                data={status.history.map(h => h.memory / 1024 / 1024)}
                max={Math.max(...status.history.map(h => h.memory / 1024 / 1024)) * 1.1}
              />
            </div>

            {/* CPU Card */}
            <div style={{
              backgroundColor: colorMode === 'dark'
                ? theme.colors.modes?.dark?.backgroundSecondary
                : theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '16px',
              border: `1px solid ${theme.colors.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <Activity size={16} style={{ marginRight: '6px', color: theme.colors.success }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>CPU</span>
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '12px',
                fontFamily: theme.fonts.mono,
              }}>
                {status.currentCpu.toFixed(1)}%
              </div>
              <Sparkline
                data={status.history.map(h => h.cpu)}
                max={100}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
```

### 6. Navigation Integration

```typescript
// src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx

// Add to navigation items, positioned above settings:
<div className="nav-bottom">
  <NavItem
    icon={<Activity size={20} />}  // Or use "📊" emoji
    label="Monitor"
    view="monitoring"
    isActive={activeView === 'monitoring'}
    onClick={() => onViewChange('monitoring')}
  />
  <NavItem
    icon={<Settings size={20} />}
    label="Settings"
    view="settings"
    isActive={activeView === 'settings'}
    onClick={() => onViewChange('settings')}
  />
</div>
```

### 7. Add View to Shell

```typescript
// src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx

import { SystemMonitor } from '../../views/SystemMonitor';

// Add to view type
export type NavigationView = 'repository' | 'terminal' | 'workspaces' |
                            'search' | 'settings' | 'monitoring';

// Add to render
{activeView === 'monitoring' && <SystemMonitor sidebarCollapsed={sidebarCollapsed} />}
```

### 8. Window API Registration

```typescript
// src/window/preload.ts

repositoryMonitoring: {
  getMonitoringStatus: () => ipcRenderer.invoke(MonitoringEvent.GET_MONITORING_STATUS),
}
```

## Notes

- **Theme Integration**: Uses `useTheme()` hook from `@a24z/industry-theme` for consistent styling
- **IPC Pattern**: Follows codebase convention with event enums in `src/shared/ipc-events/`
- **Service Layer**: Uses existing service pattern in `main-process-api/`
- **Simple Sparklines**: Inline SVG implementation to avoid additional dependencies
- **Update Frequency**: 2-second polling interval
- **History**: Maintains 30 data points (1 minute of history at 2s intervals)

## Future Enhancements

- Add event processing metrics as separate tab/section
- Implement pause/resume for monitoring
- Add export functionality for metrics
- Resource usage alerts/thresholds
- Detailed per-repository metrics