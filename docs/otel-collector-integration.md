# OpenTelemetry Collector Integration Guide

## Architecture Overview

```
┌─────────────────────────────────┐
│  web-ade (npm run dev)          │
│  Next.js App @ localhost:3000   │
│                                 │
│  - Instrumented source code     │
│  - OTEL SDK configured          │
│  - Emits trace spans & events   │
└────────────┬────────────────────┘
             │ HTTP/JSON
             │ POST to :4318/v1/traces
             ▼
┌─────────────────────────────────┐
│  OTEL Collector                 │
│  @ localhost:4318               │
│  Location: ~/Developer/         │
│    desktop-app/electron-app     │
│                                 │
│  Receives → Processes → Stores  │
└─────────────────────────────────┘
```

## What the Collector Will Receive

### 1. Protocol & Endpoint

**Protocol**: OTLP (OpenTelemetry Protocol) over HTTP
**Endpoint**: `http://localhost:4318/v1/traces`
**Method**: POST
**Content-Type**: `application/json`

### 2. Data Format

The collector will receive **trace spans** in OTLP JSON format. Each request contains:

```json
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "web-ade" } },
          { "key": "service.version", "value": { "stringValue": "0.1.0" } },
          { "key": "environment", "value": { "stringValue": "development" } }
        ]
      },
      "scopeSpans": [
        {
          "scope": {
            "name": "feature-name",
            "version": "1.0.0"
          },
          "spans": [
            {
              "traceId": "a1b2c3d4e5f6...",
              "spanId": "12345678",
              "name": "operation-name",
              "kind": 1,
              "startTimeUnixNano": "1706198400000000000",
              "endTimeUnixNano": "1706198401000000000",
              "attributes": [
                { "key": "user.id", "value": { "stringValue": "user123" } },
                { "key": "operation.type", "value": { "stringValue": "create" } }
              ],
              "events": [
                {
                  "timeUnixNano": "1706198400500000000",
                  "name": "operation.started",
                  "attributes": [
                    { "key": "input.count", "value": { "intValue": 10 } }
                  ]
                },
                {
                  "timeUnixNano": "1706198400900000000",
                  "name": "operation.complete",
                  "attributes": [
                    { "key": "result.count", "value": { "intValue": 10 } },
                    { "key": "duration.ms", "value": { "intValue": 400 } }
                  ]
                }
              ],
              "status": {
                "code": 0,
                "message": ""
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### 3. Event Types (Based on Canvas Schemas)

When you instrument features following the canvas workflow, events will include:

#### API Route Example
```javascript
// Service: web-ade-api
// Tracer: users-api
{
  "events": [
    {
      "name": "user.creation.started",
      "attributes": {
        "request.method": "POST",
        "request.path": "/api/users"
      }
    },
    {
      "name": "user.validation.complete",
      "attributes": {
        "validation.passed": true,
        "fields.validated": 5
      }
    },
    {
      "name": "user.created",
      "attributes": {
        "user.id": "usr_123",
        "duration.ms": 245
      }
    }
  ]
}
```

#### UI Interaction Example
```javascript
// Service: web-ade-ui
// Tracer: panel-interactions
{
  "events": [
    {
      "name": "panel.opened",
      "attributes": {
        "panel.type": "FileCity",
        "panel.id": "file-city-1"
      }
    },
    {
      "name": "panel.data.loaded",
      "attributes": {
        "files.count": 150,
        "load.duration.ms": 320
      }
    }
  ]
}
```

## What the web-ade App Needs to Send

### Required Configuration in web-ade

#### 1. Install Dependencies
```bash
npm install @opentelemetry/api \
            @opentelemetry/sdk-trace-web \
            @opentelemetry/exporter-trace-otlp-http \
            @opentelemetry/instrumentation
```

#### 2. Create Instrumentation Setup

**For Next.js App Router** (`instrumentation.ts` in root):
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const sdk = new NodeSDK({
      resource: new Resource({
        'service.name': 'web-ade',
        'service.version': '0.1.0',
        'environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        headers: {},
      }),
    });

    sdk.start();
  }
}
```

**For Client-Side (Browser)** (`lib/otel-browser.ts`):
```typescript
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

export function initializeBrowserTracing() {
  const provider = new WebTracerProvider({
    resource: new Resource({
      'service.name': 'web-ade-ui',
    }),
  });

  const exporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();
}
```

### 3. Emit Events from Source Code

```typescript
// src/app/api/users/route.ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('users-api', '1.0.0');

export async function POST(request: Request) {
  const span = tracer.startSpan('user.creation');

  span.addEvent('user.creation.started', {
    'request.method': 'POST',
  });

  try {
    const data = await request.json();

    span.addEvent('user.validation.started', {
      'fields.count': Object.keys(data).length,
    });

    // Business logic
    const user = await createUser(data);

    span.addEvent('user.created', {
      'user.id': user.id,
      'duration.ms': Date.now() - startTime,
    });

    span.end();
    return Response.json({ user });
  } catch (error) {
    span.addEvent('user.creation.error', {
      'error.type': error.name,
      'error.message': error.message,
    });
    span.end();
    throw error;
  }
}
```

## Collector Requirements

### Minimum Collector Configuration

The collector in `desktop-app/electron-app` needs to:

1. **Listen on HTTP port 4318** for OTLP traces
2. **Parse OTLP JSON format** (standard OTLP receiver)
3. **Handle CORS** (if web-ade UI sends from browser)
4. **Store/forward traces** based on your use case

### Example Collector Config (otel-collector-config.yaml)

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
        cors:
          allowed_origins:
            - "http://localhost:3000"  # web-ade dev server
          allowed_headers:
            - "*"

processors:
  batch:
    timeout: 1s
    send_batch_size: 100

exporters:
  # Option 1: Write to file
  file:
    path: ./traces/traces.json

  # Option 2: Forward to backend
  otlp:
    endpoint: your-backend:4317

  # Option 3: Console for debugging
  logging:
    loglevel: debug

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [file, logging]
```

## Data Volume Expectations

### Development Mode (`npm run dev`)

**Expected Traffic**:
- **API requests**: 1-10 spans per request
- **UI interactions**: 5-20 spans per user action
- **Background operations**: Varies by feature

**Estimated Volume**:
- Light usage: ~100-500 spans/minute
- Active development: ~1,000-5,000 spans/minute
- Stress testing: 10,000+ spans/minute

**Span Size**:
- Minimal span: ~500 bytes
- Average span with events: ~1-2 KB
- Large span with many events: ~5-10 KB

**Network Bandwidth**:
- Light: ~0.5-1 MB/minute
- Active: ~2-10 MB/minute

## Event Schema Alignment

### Canvas-Driven Events

When you complete the "onboard otel canvas" workflow, your events will:

1. **Match canvas schemas** defined in `.principal-views/*.otel.canvas`
2. **Include required attributes** per canvas event definitions
3. **Follow narrative scenarios** defined in `.principal-views/*.narrative.json`

Example alignment:
```typescript
// Canvas defines: operation.started event
{
  "event": "operation.started",
  "attributes": {
    "input.count": { "type": "integer", "required": true },
    "user.id": { "type": "string", "required": false }
  }
}

// Code emits matching event:
span.addEvent('operation.started', {
  'input.count': 42,        // Required
  'user.id': 'usr_123',     // Optional
});
```

## Testing the Connection

### 1. Start the Collector
```bash
cd ~/Developer/desktop-app/electron-app
# Start your collector (depends on implementation)
```

### 2. Start web-ade
```bash
cd ~/Developer/web-ade/web-ade
npm run dev
```

### 3. Verify Connection

**Check web-ade logs** for:
```
✓ OTEL exporter connected to http://localhost:4318
✓ Sent batch of 10 spans
```

**Check collector logs** for:
```
Received 10 spans from service web-ade
Processing traces for export
```

### 4. Trigger Events

- Make API requests
- Interact with UI panels
- Run instrumented features

## Environment Variables

Configure in `.env.local`:

```bash
# OTEL Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_SERVICE_NAME=web-ade
OTEL_LOG_LEVEL=info

# Enable/disable OTEL
NEXT_PUBLIC_OTEL_ENABLED=true

# Development-specific
OTEL_TRACES_SAMPLER=always_on  # Capture all traces in dev
```

## Troubleshooting

### Common Issues

**1. Connection Refused**
- Ensure collector is running on port 4318
- Check firewall rules
- Verify endpoint URL in web-ade config

**2. CORS Errors (Browser)**
- Add web-ade origin to collector CORS config
- Check browser console for errors

**3. No Spans Received**
- Verify instrumentation is initialized
- Check span export interval (may be batched)
- Look for errors in web-ade console

**4. Invalid Data Format**
- Ensure using OTLP exporter (not Jaeger/Zipkin)
- Check OTLP version compatibility
- Verify JSON vs Protobuf encoding

## Next Steps

1. **Set up collector** in electron-app with basic OTLP receiver
2. **Run onboard skill** in web-ade to instrument features
3. **Configure instrumentation.ts** in web-ade to send to collector
4. **Test end-to-end flow** with a simple API route
5. **View collected traces** in collector's output

## References

- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [OTEL JavaScript SDK](https://opentelemetry.io/docs/languages/js/)
