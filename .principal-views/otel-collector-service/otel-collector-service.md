# OTEL Collector Service

The OTEL Collector Service manages OpenTelemetry trace collection within the Electron application. It provides a centralized system for receiving, storing, and routing telemetry data from both internal and external sources.

## What Problem Does This Solve?

Distributed tracing requires a collection point for trace data. The OTEL Collector Service:

- **Receives traces** from instrumented applications via standard OTLP protocol
- **Stores traces** in a circular buffer for inspection and debugging
- **Routes traces** to interested windows via MessagePorts for real-time visualization
- **Provides a unified API** for renderer processes to interact with trace data

## Architecture Overview

The service runs as a singleton in the Electron main process and manages:

1. **Native OTEL Collector Binary** - Platform-specific binary (`otelcol_darwin_arm64`, etc.) spawned as a child process
2. **HTTP Endpoints** - OTLP receiver on port 4318 (prod) or 14318 (dev)
3. **Trace Storage** - Circular buffer holding last 50 traces
4. **MessagePort System** - Routes traces to registered windows based on service identifier

## Operations

### Starting/Stopping
```typescript
const service = OtelCollectorService.getInstance();
await service.start();  // Spawns collector binary
await service.stop();   // Stops collector and cleans up
```

### Port Registration
Windows register MessagePorts to receive trace data filtered by service identifier:
```typescript
service.registerPort(windowId, serviceIdentifier, port);
service.registerPortForServices(windowId, ['service-a', 'service-b'], port);
```

### Trace Storage
Traces are stored automatically and can be retrieved:
```typescript
const traces = service.getTraces(20);  // Get last 20 traces
service.clearTraces();                  // Clear storage
```

## Design Choices

### Singleton Pattern
Only one collector instance runs per application to avoid port conflicts and ensure centralized trace management.

### Circular Buffer
Limited to 50 traces to prevent memory growth while keeping recent traces available for debugging.

### MessagePort Routing
Uses Electron's MessageChannel API for efficient trace delivery without IPC overhead. Ports can filter by service identifier for targeted delivery.

### Wildcard Monitor
A catch-all monitor port receives ALL traces for storage, independent of window registrations.

## Common Workflows

### Sending Test Traces
The service can generate test traces for debugging:
```typescript
await window.electron.otelCollectorApi.sendTestTrace('my-service');
```

### Real-time Visualization
1. Window registers port with service identifier
2. Preload receives port via `otel-collector:port` event
3. Window subscribes via `onOtelMessage()`
4. Traces arrive as MessagePort messages

## Error Scenarios

### Binary Not Found
If the platform binary is missing, `start()` throws with the unsupported platform message.

### Port Already In Use
Dev and prod use different ports (14318 vs 4318) to allow side-by-side operation.

### Collector Crash
The `OTELCollectorServer` is configured with `restartOnCrash: true` for automatic recovery.
