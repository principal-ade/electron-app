# OpenTelemetry Integration

This document describes the OpenTelemetry (OTEL) integration in Principal ADE for distributed tracing.

## Overview

Principal ADE sends trace data to a local OpenTelemetry collector at `http://localhost:4318`. Both the main process (Node.js) and renderer processes (browser) are instrumented and can export traces.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Principal ADE                            │
│                                                                 │
│  ┌─────────────────────┐     ┌─────────────────────────────┐   │
│  │    Main Process     │     │     Renderer Processes      │   │
│  │                     │     │                             │   │
│  │  BasicTracerProvider│     │  WebTracerProvider          │   │
│  │  BatchSpanProcessor │     │  BatchSpanProcessor         │   │
│  │  OTLPTraceExporter  │     │  OTLPTraceExporter          │   │
│  │                     │     │                             │   │
│  │  Manual spans only  │     │  Auto: fetch, XHR, clicks   │   │
│  │                     │     │  + Manual spans             │   │
│  └──────────┬──────────┘     └──────────────┬──────────────┘   │
│             │                               │                   │
│             └───────────┬───────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│              POST /v1/traces (OTLP HTTP)                        │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   OTEL Collector      │
              │   localhost:4318      │
              └───────────────────────┘
```

## File Structure

```
src/
├── telemetry/
│   └── config.ts                 # Shared configuration
├── main/
│   └── telemetry/
│       └── index.ts              # Main process telemetry
└── renderer/
    └── telemetry/
        └── index.ts              # Renderer process telemetry
```

## Configuration

Configuration is defined in `src/telemetry/config.ts`:

```typescript
export const defaultTelemetryConfig = {
  enabled: true,
  collectorEndpoint: 'http://localhost:4318',
  serviceName: 'principal-ade',
  mainProcess: {
    enabled: true,
    instrumentations: {
      http: true,
      express: true,
      fs: false,  // Disabled - too noisy
    },
  },
  renderer: {
    enabled: true,
    instrumentations: {
      fetch: true,
      xhr: true,
      documentLoad: true,
      userInteraction: true,
    },
  },
};
```

### Disabling Telemetry

**Via environment variable:**
```bash
DISABLE_TELEMETRY=true npm run dev
```

**Via localStorage (renderer only):**
```javascript
localStorage.setItem('telemetry-enabled', 'false');
```

## Resource Attributes

All traces include these resource attributes:

| Attribute | Value | Description |
|-----------|-------|-------------|
| `service.name` | `principal-ade` | Application name |
| `service.version` | `0.0.x` | App version from package.json |
| `process.type` | `main` or `renderer` | Which Electron process |
| `window.type` | e.g., `dev-workspace` | Renderer window type (renderer only) |
| `electron.packaged` | `true` or `false` | Production vs development |

## Usage

### Main Process - Manual Instrumentation

```typescript
import { getTracer } from './telemetry';

// Get a tracer
const tracer = getTracer('my-service');

// Create a span
const span = tracer.startSpan('operation-name');
try {
  // Do work...
  span.setAttribute('user.id', userId);
  span.setAttribute('file.path', filePath);

  // Add events
  span.addEvent('checkpoint-reached', { step: 1 });

} catch (error) {
  // Record errors
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  throw error;
} finally {
  span.end();
}
```

### Main Process - Nested Spans

```typescript
import { getTracer } from './telemetry';
import { context, trace } from '@opentelemetry/api';

const tracer = getTracer();

async function parentOperation() {
  const parentSpan = tracer.startSpan('parent-operation');

  // Create child spans within parent context
  await context.with(trace.setSpan(context.active(), parentSpan), async () => {
    const childSpan = tracer.startSpan('child-operation');
    try {
      await doChildWork();
    } finally {
      childSpan.end();
    }
  });

  parentSpan.end();
}
```

### Renderer Process - Automatic Instrumentation

The renderer automatically instruments:

- **Fetch requests** - All `fetch()` calls create spans
- **XMLHttpRequest** - All XHR calls create spans
- **Document load** - Page load timing spans
- **User interactions** - Click and submit events

### Renderer Process - Manual Spans

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('principal-ade-renderer');

function handleButtonClick() {
  const span = tracer.startSpan('button-click-handler');
  try {
    // Handle click...
  } finally {
    span.end();
  }
}
```

## Initialization

### Main Process

Telemetry initializes automatically during app startup in `src/main/initialization.ts`:

```typescript
// After OTEL Collector starts (~2 second delay)
const { nodeTelemetry } = await import('./telemetry');
await nodeTelemetry.initialize();
```

Shutdown happens automatically during app quit:

```typescript
const { nodeTelemetry } = await import('./telemetry');
await nodeTelemetry.shutdown();
```

### Renderer Process

Each renderer entry point initializes telemetry at the top of the file:

```typescript
// src/renderer/dev-workspace/index.tsx
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('dev-workspace');

// ... rest of the app
```

## Collector Health Check

The main process checks if the collector is available before initializing:

```
[Telemetry] Collector not available at http://localhost:4318 - telemetry disabled
```

If the collector is not running, telemetry gracefully disables without affecting the app.

## Span Export

Spans are batched and exported periodically:

| Setting | Value |
|---------|-------|
| Max queue size | 100 spans |
| Max batch size | 50 spans |
| Export interval | 5 seconds |
| Export timeout | 30 seconds |

## Dependencies

The integration uses lightweight, browser-compatible packages:

```json
{
  "@opentelemetry/api": "^1.x",
  "@opentelemetry/sdk-trace-base": "^1.x",
  "@opentelemetry/sdk-trace-web": "^1.x",
  "@opentelemetry/exporter-trace-otlp-http": "^0.x",
  "@opentelemetry/resources": "^1.x",
  "@opentelemetry/semantic-conventions": "^1.x",
  "@opentelemetry/context-zone": "^1.x",
  "@opentelemetry/instrumentation": "^0.x",
  "@opentelemetry/instrumentation-fetch": "^0.x",
  "@opentelemetry/instrumentation-xml-http-request": "^0.x",
  "@opentelemetry/instrumentation-document-load": "^0.x",
  "@opentelemetry/instrumentation-user-interaction": "^0.x"
}
```

**Note:** We intentionally avoid `@opentelemetry/sdk-node` and `@opentelemetry/auto-instrumentations-node` as they pull in gRPC and other Node-only dependencies that conflict with the renderer webpack build.

## Testing Telemetry

1. Start your local OTEL collector on port 4318
2. Run the app: `npm run dev`
3. Check console for initialization logs:
   ```
   [Telemetry] Main process telemetry initialized
   [Telemetry] Sending traces to: http://localhost:4318/v1/traces
   ```
4. Perform actions in the app
5. View traces in your collector's UI

## Troubleshooting

### Traces not appearing

1. Verify collector is running on port 4318
2. Check console for `[Telemetry]` logs
3. Ensure `DISABLE_TELEMETRY` is not set
4. Check localStorage for `telemetry-enabled: false`

### Webpack build errors

If you see errors about `net`, `http2`, or `async_hooks`:
- A Node-only OTEL package was added
- Remove it and use browser-compatible alternatives
- Only use packages from the approved list above

### High memory usage

Reduce span volume by:
- Increasing `scheduledDelayMillis`
- Decreasing `maxQueueSize`
- Disabling noisy instrumentations in config
