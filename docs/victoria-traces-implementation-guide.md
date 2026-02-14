# VictoriaTraces Implementation Guide

Quick reference for implementing the VictoriaTraces managed integration.

## Quick Start

### 1. Install Dependencies

```bash
cd packages/otel-collector-server
npm install open  # For opening VMUI in browser
```

### 2. Create VictoriaTracesManager

**File**: `packages/otel-collector-server/src/services/VictoriaTracesManager.ts`

Copy the full implementation from [VICTORIA_TRACES_LOCAL_STORAGE.md](./VICTORIA_TRACES_LOCAL_STORAGE.md#1-victoriatracesmanager)

### 3. Create HTTPOutput

**File**: `packages/otel-collector-server/src/output/HTTPOutput.ts`

```typescript
import { IExportTraceServiceRequest } from '@opentelemetry/otlp-transformer';
import { TraceOutput } from './TraceOutput';
import { Logger, createLogger } from '../shared/logger';

export interface HTTPOutputConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export class HTTPOutput implements TraceOutput {
  private logger: Logger;
  private config: Required<HTTPOutputConfig>;

  constructor(config: HTTPOutputConfig, logger?: Logger) {
    this.logger = logger || createLogger('HTTPOutput');
    this.config = {
      timeout: 10000,
      retries: 3,
      headers: {},
      ...config,
    };
  }

  async send(payload: IExportTraceServiceRequest, source: string): Promise<void> {
    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-Source': source,
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.debug(`Sent trace from ${source}`);
    } catch (error) {
      this.logger.error('Failed to send trace:', error);
      // Non-blocking: don't crash collector
    }
  }
}
```

### 4. Update OTELCollectorServer

**File**: `packages/otel-collector-server/src/OTELCollectorServer.ts`

Add to config interface:
```typescript
interface OTELCollectorServerConfig {
  // ... existing config

  enableLocalStorage?: boolean;
  victoriaTraces?: {
    autoStart?: boolean;
    retentionDays?: number;
  };
}
```

Add to class:
```typescript
import { VictoriaTracesManager } from './services/VictoriaTracesManager';
import { HTTPOutput } from './output/HTTPOutput';

export class OTELCollectorServer extends EventEmitter {
  private victoriaTracesManager?: VictoriaTracesManager;
  private victoriaTracesOutput?: HTTPOutput;

  constructor(config: OTELCollectorServerConfig) {
    super();
    // ... existing constructor

    if (config.enableLocalStorage) {
      this.victoriaTracesManager = new VictoriaTracesManager({
        retentionDays: config.victoriaTraces?.retentionDays || 7,
      });
    }
  }

  async startVictoriaTraces(): Promise<void> {
    if (!this.victoriaTracesManager) {
      throw new Error('VictoriaTraces not enabled');
    }

    const dockerAvailable = await this.victoriaTracesManager.isDockerAvailable();
    if (!dockerAvailable) {
      throw new Error('Docker not available');
    }

    await this.victoriaTracesManager.start();

    this.victoriaTracesOutput = new HTTPOutput({
      url: this.victoriaTracesManager.getEndpoint(),
    });

    // Add to outputs array
    if (Array.isArray(this.outputs)) {
      this.outputs.push(this.victoriaTracesOutput);
    }

    // Monitor health
    this.victoriaTracesManager.startHealthMonitoring((status) => {
      this.emit('victoria-traces-status', status);
    });
  }

  async stopVictoriaTraces(): Promise<void> {
    await this.victoriaTracesManager?.stop();
    if (this.victoriaTracesOutput && Array.isArray(this.outputs)) {
      const idx = this.outputs.indexOf(this.victoriaTracesOutput);
      if (idx > -1) this.outputs.splice(idx, 1);
    }
  }

  async getVictoriaTracesStatus() {
    return await this.victoriaTracesManager?.getStatus() || null;
  }
}
```

### 5. Add Electron IPC Handlers

**File**: `src/main/ipc/victoria-traces-handlers.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { OTELCollectorServer } from '@principal-ai/otel-collector-server';

export function setupVictoriaTracesHandlers(
  collectorServer: OTELCollectorServer
) {
  ipcMain.handle('victoria-traces:start', async () => {
    await collectorServer.startVictoriaTraces();
  });

  ipcMain.handle('victoria-traces:stop', async () => {
    await collectorServer.stopVictoriaTraces();
  });

  ipcMain.handle('victoria-traces:get-status', async () => {
    return await collectorServer.getVictoriaTracesStatus();
  });

  ipcMain.handle('victoria-traces:get-stats', async () => {
    const manager = collectorServer['victoriaTracesManager'];
    if (!manager) return null;
    return await manager.getStorageStats();
  });

  ipcMain.handle('victoria-traces:open-ui', async () => {
    const manager = collectorServer['victoriaTracesManager'];
    if (!manager) return;
    await manager.openUI();
  });

  // Forward status events to renderer
  collectorServer.on('victoria-traces-status', (status) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('victoria-traces:status-update', status);
    });
  });
}
```

Register in main process:
```typescript
// src/main/main.ts
import { setupVictoriaTracesHandlers } from './ipc/victoria-traces-handlers';

// After creating collectorServer
setupVictoriaTracesHandlers(collectorServer);
```

### 6. Add Preload API

**File**: `src/main/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('victoriaTraces', {
  start: () => ipcRenderer.invoke('victoria-traces:start'),
  stop: () => ipcRenderer.invoke('victoria-traces:stop'),
  getStatus: () => ipcRenderer.invoke('victoria-traces:get-status'),
  getStats: () => ipcRenderer.invoke('victoria-traces:get-stats'),
  openUI: () => ipcRenderer.invoke('victoria-traces:open-ui'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('victoria-traces:status-update', (_, status) => {
      callback(status);
    });
  },
});
```

TypeScript types:
```typescript
// src/renderer/types/window.d.ts
interface VictoriaTracesStatus {
  isRunning: boolean;
  isHealthy: boolean;
  containerExists: boolean;
  endpoint?: string;
  error?: string;
}

interface Window {
  victoriaTraces: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getStatus: () => Promise<VictoriaTracesStatus>;
    getStats: () => Promise<{ size: string; location: string }>;
    openUI: () => Promise<void>;
    onStatusUpdate: (callback: (status: VictoriaTracesStatus) => void) => void;
  };
}
```

### 7. Create Settings UI Component

**File**: `src/renderer/components/settings/TraceStorageSettings.tsx`

```typescript
import React, { useState, useEffect } from 'react';

export function TraceStorageSettings() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadStatus();
    window.victoriaTraces.onStatusUpdate((newStatus) => {
      setStatus(newStatus.isHealthy ? 'running' :
                newStatus.isRunning ? 'starting' : 'stopped');
      setError(newStatus.error);
    });
  }, []);

  async function loadStatus() {
    const currentStatus = await window.victoriaTraces.getStatus();
    setEnabled(currentStatus.isRunning);
    setStatus(currentStatus.isHealthy ? 'running' :
              currentStatus.isRunning ? 'starting' : 'stopped');
  }

  async function handleToggle() {
    setLoading(true);
    try {
      if (enabled) {
        await window.victoriaTraces.stop();
        setEnabled(false);
        setStatus('stopped');
      } else {
        await window.victoriaTraces.start();
        setEnabled(true);
        setStatus('starting');
      }
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="trace-storage-settings">
      <h2>Local Trace Storage</h2>

      <div className="setting-row">
        <div>
          <h3>Enable Local Database</h3>
          <p>Store traces on your machine with VictoriaTraces</p>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={loading}
        />
      </div>

      {enabled && (
        <div className="status-section">
          <div className="status">
            {status === 'running' && '✓ Running & Healthy'}
            {status === 'starting' && '⟳ Starting...'}
            {status === 'error' && `✗ Error: ${error}`}
          </div>

          {status === 'running' && (
            <button onClick={() => window.victoriaTraces.openUI()}>
              Open Query UI
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Add to Settings panel:
```typescript
// src/renderer/components/settings/SettingsPanel.tsx
import { TraceStorageSettings } from './TraceStorageSettings';

export function SettingsPanel() {
  return (
    <div className="settings-panel">
      {/* ... other settings */}
      <TraceStorageSettings />
    </div>
  );
}
```

---

## Testing Checklist

### Manual Testing

1. **Docker Detection**
   ```bash
   # Stop Docker Desktop
   # Toggle ON in app
   # Should show: "Docker not available"

   # Start Docker Desktop
   # Toggle ON again
   # Should start successfully
   ```

2. **Container Lifecycle**
   ```bash
   # Enable in UI
   docker ps | grep principal-victoria-traces
   # Should show running container

   # Disable in UI
   docker ps -a | grep principal-victoria-traces
   # Should show stopped container
   ```

3. **Health Monitoring**
   ```bash
   # Enable in UI
   # Stop container manually
   docker stop principal-victoria-traces
   # UI should show error within 5-10 seconds
   ```

4. **Trace Storage**
   ```bash
   # Enable local storage
   # Send test trace
   curl -X POST http://localhost:10428/insert/opentelemetry/v1/traces \
     -H "Content-Type: application/json" \
     -d '{"resourceSpans":[...]}'

   # Open VMUI
   # Should see trace in UI
   ```

### Unit Tests

```typescript
describe('VictoriaTracesManager', () => {
  test('detects Docker availability', async () => {
    const manager = new VictoriaTracesManager();
    const available = await manager.isDockerAvailable();
    expect(typeof available).toBe('boolean');
  });

  test('returns correct endpoint URL', () => {
    const manager = new VictoriaTracesManager({ httpPort: 12345 });
    expect(manager.getEndpoint()).toBe(
      'http://localhost:12345/insert/opentelemetry/v1/traces'
    );
  });
});
```

---

## Troubleshooting

### Container Won't Start

**Check Docker is running:**
```bash
docker ps
```

**Check port availability:**
```bash
lsof -i :10428
```

**View container logs:**
```bash
docker logs principal-victoria-traces
```

### Health Check Failing

**Test endpoint manually:**
```bash
curl http://localhost:10428/metrics
```

**Check container status:**
```bash
docker ps -a | grep principal-victoria-traces
docker inspect principal-victoria-traces
```

### Traces Not Appearing

**Verify HTTPOutput is sending:**
- Check OTEL collector logs
- Should see "Sent trace from ..."

**Test endpoint directly:**
```bash
curl -X POST http://localhost:10428/insert/opentelemetry/v1/traces \
  -H "Content-Type: application/json" \
  -d @test-trace.json
```

---

## Performance Considerations

### Memory Usage
- VictoriaTraces: 500MB - 2GB
- HTTPOutput: Minimal (<10MB)
- Total overhead: ~500MB

### Disk Usage
- Binary (in image): ~300MB
- Data volume: Grows with traces
- Default retention: 7 days auto-cleanup

### Network
- Local communication only (no external traffic)
- HTTP POST per trace (minimal overhead)

---

## Next Steps

After implementation:

1. **Test thoroughly** with all scenarios
2. **Add retention settings** in UI (currently 7 days)
3. **Add storage quota warnings** (when approaching disk limits)
4. **Implement data export** (backup traces)
5. **Add contract-based filtering** (store only anomalies)

---

## Resources

- [Full Documentation](./VICTORIA_TRACES_LOCAL_STORAGE.md)
- [VictoriaTraces Docs](https://docs.victoriametrics.com/victoriatraces/)
- [OTEL Integration Docs](./DEV_WORKSPACE_OTEL_INTEGRATION.md)
