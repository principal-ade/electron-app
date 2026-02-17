# RegisteredTrace Implementation Guide

**Status**: 🚧 In Progress
**Date**: February 16, 2026
**Replaces**: TraceInfo type

---

## Overview

This guide documents the migration from `TraceInfo` (dumb OTLP aggregation) to `RegisteredTrace` (registry-aware trace with routing information). The conversion happens in **otel-collection-server** before traces reach renderers.

### Architecture Change

**Before:**
```
OTLP → Collector → Renderer → groupSpansByTrace() → TraceInfo → Display
```

**After:**
```
OTLP → Collector → Registry Matcher → RegisteredTrace → Renderer → Display
```

---

## Phase 1: Principal View Core Library ✅

### Status: COMPLETED

The `RegisteredTrace` type and interfaces have been created and exported from `@principal-ai/principal-view-core@0.23.13`.

**New types:**
- `RegisteredTrace` - Full registry-aware trace type
- `RegistryLookupResult` - Registry lookup response
- `StoryboardRegistryInterface` - Interface for registry implementation
- `TraceRegistryMatcher` - Interface for trace matching

**Location**: `/Users/griever/Developer/visual-validation/principal-view-core-library/packages/core/src/types/registered-trace.ts`

---

## Phase 2: OTEL Collection Server

### Objective

Update `@principal-ai/otel-collector-server` to:
1. Accept a `StoryboardRegistryInterface` implementation
2. Perform trace matching when OTLP traces arrive
3. Convert OTLP → RegisteredTrace
4. Route RegisteredTrace (not raw OTLP) to renderers

### Implementation Steps

#### Step 1: Add principal-view-core dependency

**File**: `/Users/griever/Developer/my-projects/otel-collection-server/package.json`

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/otlp-transformer": "^0.52.0",
    "@opentelemetry/sdk-trace-base": "^1.25.0",
    "@principal-ai/principal-view-core": "^0.23.13",  // ← Add this
    "yaml": "^2.3.0"
  }
}
```

Run:
```bash
cd /Users/griever/Developer/my-projects/otel-collection-server
npm install
```

#### Step 2: Create TraceRegistryMatcher implementation

**File**: `/Users/griever/Developer/my-projects/otel-collection-server/src/matching/TraceRegistryMatcher.ts`

```typescript
import type {
  RegisteredTrace,
  TraceRegistryMatcher as ITraceRegistryMatcher,
  StoryboardRegistryInterface,
  RegistryLookupResult,
} from '@principal-ai/principal-view-core';
import type { IExportTraceServiceRequest } from '@opentelemetry/otlp-transformer';
import { Logger, createLogger } from '../shared/logger';

export class TraceRegistryMatcher implements ITraceRegistryMatcher {
  private logger: Logger;

  constructor(
    private registry: StoryboardRegistryInterface,
    logger?: Logger
  ) {
    this.logger = logger || createLogger('TraceRegistryMatcher');
  }

  async matchTrace(otlpData: IExportTraceServiceRequest): Promise<RegisteredTrace> {
    try {
      // Extract basic trace info
      const traceId = this.extractTraceId(otlpData);
      const name = this.extractTraceName(otlpData);
      const { startTime, endTime } = this.extractTimeRange(otlpData);
      const duration = endTime - startTime;
      const spanCount = this.countSpans(otlpData);
      const serviceName = this.extractServiceName(otlpData);
      const hasErrors = this.detectErrors(otlpData);

      // Extract scope info
      const scope = this.extractScope(otlpData);

      // Extract match info (pv.* attributes)
      const matchInfo = this.extractMatchInfo(otlpData);

      // Extract source URL for routing
      const sourceUrl = this.extractSourceUrl(otlpData);

      if (!matchInfo) {
        // Unmatched trace (no pv.* attributes)
        return {
          traceId,
          name,
          startTime,
          endTime,
          duration,
          spanCount,
          serviceName,
          hasErrors,
          scope,
          registryStatus: 'unmatched',
          spanMatches: [],
          matchedNodesSummary: {
            totalNodesMatched: 0,
            matchedNodeIds: [],
            unmatchedNodeIds: [],
            coveragePercent: 0,
          },
          routing: {
            sourceUrl,
            destination: 'trace-viewer',
          },
          otlpData,
        };
      }

      // Resolve schema version
      const schemaVersion = this.resolveSchemaVersion(matchInfo, scope);

      // Look up in registry
      const registry = await this.registry.lookup(
        matchInfo.storyboardId,
        schemaVersion
      );

      // Determine registry status
      let registryStatus: RegisteredTrace['registryStatus'];
      if (!registry.isRegistered) {
        registryStatus = 'not-registered';
      } else if (registry.versionStatus === 'not-found') {
        registryStatus = 'version-mismatch';
      } else if (registry.versionStatus === 'exact-match' || registry.versionStatus === 'fallback-to-latest') {
        registryStatus = 'matched';
      } else {
        registryStatus = 'error';
      }

      // TODO: Implement span matching
      // For now, return empty span matches
      const spanMatches: RegisteredTrace['spanMatches'] = [];
      const matchedNodesSummary = {
        totalNodesMatched: 0,
        matchedNodeIds: [],
        unmatchedNodeIds: [],
        coveragePercent: 0,
      };

      // Determine routing destination
      const routing = this.determineRouting(matchInfo, registry, sourceUrl);

      return {
        traceId,
        name,
        startTime,
        endTime,
        duration,
        spanCount,
        serviceName,
        hasErrors,
        scope,
        registryStatus,
        matchInfo: {
          ...matchInfo,
          schemaVersion,
        },
        registry,
        spanMatches,
        matchedNodesSummary,
        routing,
        otlpData,
      };
    } catch (error) {
      this.logger.error('Error matching trace:', error);
      throw error;
    }
  }

  async resolveSchemaVersion(
    storyboardId: string,
    scopeVersion?: string,
    scopeAttributes?: Record<string, unknown>
  ): Promise<{
    resolvedVersion?: string;
    versionStatus: 'exact-match' | 'fallback-to-latest' | 'not-found';
    availableVersions: string[];
  }> {
    // Priority: pv.schema.version > scopeVersion > latest
    const explicitVersion = scopeAttributes?.['pv.schema.version'] as string | undefined;
    const targetVersion = explicitVersion || scopeVersion;

    const lookup = await this.registry.lookup(storyboardId, targetVersion);

    return {
      resolvedVersion: lookup.resolvedVersion,
      versionStatus: lookup.versionStatus || 'not-found',
      availableVersions: lookup.availableVersions || [],
    };
  }

  // Helper methods

  private extractTraceId(otlpData: IExportTraceServiceRequest): string {
    const firstSpan = otlpData.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0];
    return firstSpan?.traceId || 'unknown';
  }

  private extractTraceName(otlpData: IExportTraceServiceRequest): string {
    // Find root span (no parentSpanId) or use first span
    const allSpans = otlpData.resourceSpans?.[0]?.scopeSpans?.[0]?.spans || [];
    const rootSpan = allSpans.find(s => !s.parentSpanId) || allSpans[0];
    return rootSpan?.name || 'Unknown Trace';
  }

  private extractTimeRange(otlpData: IExportTraceServiceRequest): { startTime: number; endTime: number } {
    let minStart = Number.MAX_SAFE_INTEGER;
    let maxEnd = 0;

    otlpData.resourceSpans?.forEach(rs => {
      rs.scopeSpans?.forEach(ss => {
        ss.spans?.forEach(span => {
          const start = this.nanoToMillis(span.startTimeUnixNano);
          const end = this.nanoToMillis(span.endTimeUnixNano);
          if (start < minStart) minStart = start;
          if (end > maxEnd) maxEnd = end;
        });
      });
    });

    return {
      startTime: minStart === Number.MAX_SAFE_INTEGER ? Date.now() : minStart,
      endTime: maxEnd || Date.now(),
    };
  }

  private countSpans(otlpData: IExportTraceServiceRequest): number {
    let count = 0;
    otlpData.resourceSpans?.forEach(rs => {
      rs.scopeSpans?.forEach(ss => {
        count += ss.spans?.length || 0;
      });
    });
    return count;
  }

  private extractServiceName(otlpData: IExportTraceServiceRequest): string {
    const resource = otlpData.resourceSpans?.[0]?.resource;
    const serviceNameAttr = resource?.attributes?.find(attr => attr.key === 'service.name');
    return (serviceNameAttr?.value?.stringValue as string) || 'unknown';
  }

  private detectErrors(otlpData: IExportTraceServiceRequest): boolean {
    let hasError = false;
    otlpData.resourceSpans?.forEach(rs => {
      rs.scopeSpans?.forEach(ss => {
        ss.spans?.forEach(span => {
          if (span.status?.code === 2) { // ERROR
            hasError = true;
          }
        });
      });
    });
    return hasError;
  }

  private extractScope(otlpData: IExportTraceServiceRequest): RegisteredTrace['scope'] {
    const scopeSpan = otlpData.resourceSpans?.[0]?.scopeSpans?.[0];
    const scope = scopeSpan?.scope;

    return {
      name: scope?.name || 'unknown',
      version: scope?.version,
      attributes: scope?.attributes ? this.convertAttributes(scope.attributes) : undefined,
      schemaUrl: scopeSpan?.schemaUrl,
    };
  }

  private extractMatchInfo(otlpData: IExportTraceServiceRequest) {
    const resource = otlpData.resourceSpans?.[0]?.resource;
    if (!resource?.attributes) return undefined;

    const getAttr = (key: string) => {
      const attr = resource.attributes?.find(a => a.key === key);
      return attr?.value?.stringValue as string | undefined;
    };

    const storyboardId = getAttr('pv.storyboard.id');
    const storyboardName = getAttr('pv.storyboard.name');

    if (!storyboardId || !storyboardName) return undefined;

    return {
      storyboardId,
      storyboardName,
      workflowId: getAttr('pv.workflow.id'),
      workflowName: getAttr('pv.workflow.name'),
      scenarioId: getAttr('pv.scenario.id'),
      scenarioName: getAttr('pv.scenario.name'),
    };
  }

  private extractSourceUrl(otlpData: IExportTraceServiceRequest): string {
    const resource = otlpData.resourceSpans?.[0]?.resource;
    const getAttr = (key: string) => {
      const attr = resource?.attributes?.find(a => a.key === key);
      return attr?.value?.stringValue as string | undefined;
    };

    return getAttr('dev.server.url') || getAttr('service.name') || 'unknown';
  }

  private resolveSchemaVersion(
    matchInfo: NonNullable<ReturnType<typeof this.extractMatchInfo>>,
    scope: RegisteredTrace['scope']
  ): string | undefined {
    // Priority: pv.schema.version > scope.version
    return (scope.attributes?.['pv.schema.version'] as string) || scope.version;
  }

  private determineRouting(
    matchInfo: NonNullable<ReturnType<typeof this.extractMatchInfo>>,
    registry: RegistryLookupResult,
    sourceUrl: string
  ): RegisteredTrace['routing'] {
    if (!registry.isRegistered) {
      return {
        sourceUrl,
        destination: 'unmatched',
      };
    }

    if (matchInfo.scenarioId) {
      return {
        sourceUrl,
        destination: 'scenario-viewer',
        params: {
          storyboardId: matchInfo.storyboardId,
          workflowId: matchInfo.workflowId,
          scenarioId: matchInfo.scenarioId,
          schemaVersion: registry.resolvedVersion,
        },
      };
    }

    return {
      sourceUrl,
      destination: 'storyboard-viewer',
      params: {
        storyboardId: matchInfo.storyboardId,
        workflowId: matchInfo.workflowId,
        schemaVersion: registry.resolvedVersion,
      },
    };
  }

  private nanoToMillis(nanos: string | number | undefined): number {
    if (!nanos) return 0;
    const nanosNum = typeof nanos === 'string' ? parseInt(nanos, 10) : nanos;
    return Math.floor(nanosNum / 1_000_000);
  }

  private convertAttributes(attrs: any[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    attrs?.forEach(attr => {
      const value = attr.value?.stringValue || attr.value?.intValue || attr.value?.boolValue;
      if (value !== undefined) {
        result[attr.key] = value;
      }
    });
    return result;
  }
}
```

#### Step 3: Update OTLPForwardingServer

**File**: `/Users/griever/Developer/my-projects/otel-collection-server/src/server/OTLPForwardingServer.ts`

Add to constructor parameters:

```typescript
import type { StoryboardRegistryInterface } from '@principal-ai/principal-view-core';
import { TraceRegistryMatcher } from '../matching/TraceRegistryMatcher';

export interface HTTPServerConfig {
  port: number;
  enableCORS?: boolean;
  versionRegistry?: {
    url: string;
    customerId: string;
    cacheTTL?: number;
  };
  // NEW: Storyboard registry for trace matching
  storyboardRegistry?: StoryboardRegistryInterface;
}

export class OTLPForwardingServer {
  private logger: Logger;
  private server: http.Server | null = null;
  private port: number;
  private tracesReceived: number = 0;
  private tracer = trace.getTracer('trace-ingestion', '1.0.0');
  private serviceStats: ServiceStatsTracker;
  private versionRegistry: VersionRegistryClient;
  private traceMatcher?: TraceRegistryMatcher;  // NEW

  constructor(
    private config: HTTPServerConfig,
    private traceOutput: TraceOutput,
    logger?: Logger
  ) {
    this.logger = logger || createLogger('OTLPForwardingServer');
    this.port = config.port;
    this.serviceStats = new ServiceStatsTracker();

    // Initialize version registry client
    this.versionRegistry = new VersionRegistryClient(
      config.versionRegistry?.url,
      config.versionRegistry?.cacheTTL
    );

    // NEW: Initialize trace matcher if registry provided
    if (config.storyboardRegistry) {
      this.traceMatcher = new TraceRegistryMatcher(
        config.storyboardRegistry,
        this.logger
      );
      this.logger.info('Trace registry matching enabled');
    } else {
      this.logger.warn('No storyboard registry provided - traces will not be matched');
    }
  }
```

Update the `handleTraceRequest` method to match traces:

```typescript
  private async handleTraceRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const span = this.tracer.startSpan('otlp.request.processing');
    const startTime = Date.now();

    try {
      // ... existing code to read body and parse OTLP ...

      const payload = /* parsed OTLP */;

      // NEW: Match trace if matcher available
      if (this.traceMatcher) {
        const registeredTrace = await this.traceMatcher.matchTrace(payload);
        this.logger.debug('Matched trace:', {
          traceId: registeredTrace.traceId,
          status: registeredTrace.registryStatus,
          destination: registeredTrace.routing.destination,
        });

        // Send RegisteredTrace instead of raw OTLP
        this.traceOutput.send(registeredTrace, registeredTrace.routing.sourceUrl);
      } else {
        // Fallback: send raw OTLP (backward compatibility)
        const sourceUrl = this.extractSourceUrl(payload);
        this.traceOutput.send(payload, sourceUrl);
      }

      // ... rest of request handling ...
    } catch (error) {
      // ... error handling ...
    }
  }
```

#### Step 4: Update TraceOutput interface

**File**: `/Users/griever/Developer/my-projects/otel-collection-server/src/output/TraceOutput.ts`

```typescript
import type { RegisteredTrace } from '@principal-ai/principal-view-core';
import type { IExportTraceServiceRequest } from '@opentelemetry/otlp-transformer';

export interface TraceOutput {
  /**
   * Send trace payload to output
   *
   * @param payload - RegisteredTrace (new) or IExportTraceServiceRequest (legacy)
   * @param source - Source URL for routing
   */
  send(payload: RegisteredTrace | IExportTraceServiceRequest, source: string): void;
}
```

#### Step 5: Update MessagePortOutput

**File**: `/Users/griever/Developer/my-projects/otel-collection-server/src/output/MessagePortOutput.ts`

```typescript
import type { RegisteredTrace } from '@principal-ai/principal-view-core';
import type { IExportTraceServiceRequest } from '@opentelemetry/otlp-transformer';
import { TraceOutput } from './TraceOutput';
import { PortRouter } from '../router/PortRouter';

export class MessagePortOutput implements TraceOutput {
  private router: PortRouter;

  constructor(router: PortRouter) {
    this.router = router;
  }

  send(payload: RegisteredTrace | IExportTraceServiceRequest, source: string): void {
    // Determine payload type
    const isRegisteredTrace = 'registryStatus' in payload;

    if (isRegisteredTrace) {
      // New format: RegisteredTrace
      this.router.routePayload(payload as RegisteredTrace, source, 'REGISTERED_TRACE');
    } else {
      // Legacy format: raw OTLP
      this.router.routePayload(payload as IExportTraceServiceRequest, source, 'TRACE_BATCH');
    }
  }

  getRouter(): PortRouter {
    return this.router;
  }
}
```

#### Step 6: Update PortRouter

**File**: `/Users/griever/Developer/my-projects/otel-collection-server/src/router/PortRouter.ts`

```typescript
import type { RegisteredTrace } from '@principal-ai/principal-view-core';

// Update routePayload signature
routePayload(
  payload: RegisteredTrace | IExportTraceServiceRequest,
  source: string,
  messageType: 'REGISTERED_TRACE' | 'TRACE_BATCH' = 'TRACE_BATCH'
): void {
  // ... existing routing logic ...

  // When posting to ports:
  port.postMessage({
    type: messageType,  // Use dynamic message type
    payload,
    source,
    timestamp: Date.now(),
  });
}
```

#### Step 7: Export new types

**File**: `/Users/griever/Developer/my-projects/otel-collection-server/src/index.ts`

```typescript
// Export matching types
export type { RegisteredTrace } from '@principal-ai/principal-view-core';
export { TraceRegistryMatcher } from './matching/TraceRegistryMatcher';
```

---

## Phase 3: Electron App

### Step 1: Create StoryboardRegistry implementation

**File**: `/Users/griever/Developer/desktop-app/electron-app/src/main/services/StoryboardRegistryService.ts`

```typescript
import type { StoryboardRegistryInterface, RegistryLookupResult } from '@principal-ai/principal-view-core';
import path from 'path';
import fs from 'fs/promises';

export class StoryboardRegistryService implements StoryboardRegistryInterface {
  private canvasesPath: string;

  constructor(repositoryPath: string) {
    this.canvasesPath = path.join(repositoryPath, '.principal-views');
  }

  async lookup(storyboardId: string, schemaVersion?: string): Promise<RegistryLookupResult> {
    try {
      // Look for canvas file
      // Format: storyboardId.canvas or storyboardId@version.canvas
      const canvasFiles = await this.findCanvasFiles(storyboardId);

      if (canvasFiles.length === 0) {
        return {
          isRegistered: false,
          storyboardId,
        };
      }

      // If version specified, try exact match first
      if (schemaVersion) {
        const versionedFile = `${storyboardId}@${schemaVersion}.canvas`;
        if (canvasFiles.includes(versionedFile)) {
          return {
            isRegistered: true,
            storyboardId,
            resolvedVersion: schemaVersion,
            availableVersions: this.extractVersions(canvasFiles, storyboardId),
            latestVersion: this.getLatestVersion(canvasFiles, storyboardId),
            isLatestVersion: schemaVersion === this.getLatestVersion(canvasFiles, storyboardId),
            versionStatus: 'exact-match',
          };
        }
      }

      // Fallback to latest
      const latestVersion = this.getLatestVersion(canvasFiles, storyboardId);

      return {
        isRegistered: true,
        storyboardId,
        resolvedVersion: latestVersion,
        availableVersions: this.extractVersions(canvasFiles, storyboardId),
        latestVersion,
        isLatestVersion: true,
        versionStatus: schemaVersion ? 'fallback-to-latest' : 'exact-match',
      };
    } catch (error) {
      console.error(`Error looking up storyboard ${storyboardId}:`, error);
      return {
        isRegistered: false,
        storyboardId,
      };
    }
  }

  async listStoryboards(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.canvasesPath);
      const canvasFiles = files.filter(f => f.endsWith('.canvas'));

      // Extract unique storyboard IDs (remove versions)
      const ids = new Set<string>();
      canvasFiles.forEach(file => {
        const match = file.match(/^([^@]+)(@.*)?\.canvas$/);
        if (match) {
          ids.add(match[1]);
        }
      });

      return Array.from(ids);
    } catch (error) {
      return [];
    }
  }

  async isRegistered(storyboardId: string): Promise<boolean> {
    const result = await this.lookup(storyboardId);
    return result.isRegistered;
  }

  // Helper methods

  private async findCanvasFiles(storyboardId: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.canvasesPath);
      return files.filter(f => {
        return f.startsWith(storyboardId) && f.endsWith('.canvas');
      });
    } catch (error) {
      return [];
    }
  }

  private extractVersions(files: string[], storyboardId: string): string[] {
    const versions: string[] = [];
    files.forEach(file => {
      const match = file.match(new RegExp(`^${storyboardId}@(.+)\\.canvas$`));
      if (match) {
        versions.push(match[1]);
      }
    });
    return versions;
  }

  private getLatestVersion(files: string[], storyboardId: string): string | undefined {
    const versions = this.extractVersions(files, storyboardId);

    if (versions.length === 0) {
      // Check for unversioned file
      if (files.includes(`${storyboardId}.canvas`)) {
        return undefined; // Unversioned
      }
      return undefined;
    }

    // Sort versions (simple string sort for now, should use semver)
    return versions.sort().reverse()[0];
  }
}
```

### Step 2: Inject registry into OtelCollectorService

**File**: `/Users/griever/Developer/desktop-app/electron-app/src/main/services/OtelCollectorService.ts`

```typescript
import { StoryboardRegistryService } from './StoryboardRegistryService';

export class OtelCollectorService {
  private registryService?: StoryboardRegistryService;

  constructor(/* ... */) {
    // ... existing initialization ...
  }

  async start(): Promise<void> {
    // ... existing code ...

    // NEW: Create registry service if repository path available
    if (this.repositoryPath) {
      this.registryService = new StoryboardRegistryService(this.repositoryPath);
    }

    // Pass registry to collector server config
    const config = {
      // ... existing config ...
      storyboardRegistry: this.registryService,
    };

    await this.server.start(config);
  }
}
```

### Step 3: Update RepositoryPanelContext

**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/contexts/RepositoryPanelContext.tsx`

```typescript
import type { RegisteredTrace } from '@principal-ai/principal-view-core';

// Replace:
const [telemetryTraces, setTelemetryTraces] = useState<TraceInfo[]>([]);

// With:
const [registeredTraces, setRegisteredTraces] = useState<RegisteredTrace[]>([]);

// In message handler:
window.electron.onOtelMessage(windowId, sourceUrl, (message) => {
  // Check message type
  if (message?.type === 'REGISTERED_TRACE') {
    const trace = message.payload as RegisteredTrace;

    console.info('[RepositoryPanelProvider] Received RegisteredTrace:', {
      traceId: trace.traceId,
      status: trace.registryStatus,
      destination: trace.routing.destination,
    });

    setRegisteredTraces(prev => {
      const existingIds = new Set(prev.map(t => t.traceId));
      if (existingIds.has(trace.traceId)) return prev;
      return [...prev, trace].slice(-1000);
    });
  } else if (message?.type === 'TRACE_BATCH') {
    // Legacy OTLP format - convert using groupSpansByTrace
    // (for backward compatibility during migration)
    const newTraces = groupSpansByTrace(message.payload);
    // ... existing logic ...
  }
});
```

### Step 4: Update data slice

**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/contexts/RepositoryPanelContext.tsx`

```typescript
// Update telemetry data slice
const telemetrySlice: DataSlice = useMemo(() => ({
  name: 'telemetry',
  data: registeredTraces,  // Now RegisteredTrace[] instead of TraceInfo[]
  sha: telemetrySha,
}), [registeredTraces, telemetrySha]);
```

---

## Phase 4: UI Updates

### TraceListPanel

Update to display registry status:

```typescript
traces.map(trace => (
  <TraceRow
    key={trace.traceId}
    trace={trace}
    // NEW: Show registry info
    badge={trace.registryStatus === 'matched' ? 'Matched' : 'Unmatched'}
    badgeColor={trace.registryStatus === 'matched' ? 'green' : 'gray'}
    schemaVersion={trace.registry?.resolvedVersion}
    coverage={trace.matchedNodesSummary.coveragePercent}
  />
))
```

### Routing Logic

```typescript
function handleTraceSelect(trace: RegisteredTrace) {
  switch (trace.routing.destination) {
    case 'storyboard-viewer':
      openStoryboardTab(trace.routing.params);
      break;
    case 'scenario-viewer':
      openScenarioTab(trace.routing.params);
      break;
    case 'trace-viewer':
    case 'unmatched':
    default:
      openTraceDetailsTab(trace);
  }
}
```

---

## Migration Checklist

- [x] Define RegisteredTrace type in principal-view-core-library
- [x] Export types from principal-view-core-library
- [x] Build principal-view-core-library package
- [ ] Add principal-view-core dependency to otel-collection-server
- [ ] Create TraceRegistryMatcher implementation
- [ ] Update OTLPForwardingServer to use matcher
- [ ] Update MessagePortOutput and PortRouter
- [ ] Create StoryboardRegistryService in electron-app
- [ ] Inject registry into OtelCollectorService
- [ ] Update RepositoryPanelContext to consume RegisteredTrace
- [ ] Update TraceListPanel UI
- [ ] Add routing logic for different destinations
- [ ] Test end-to-end flow
- [ ] Deprecate TraceInfo type

---

## Testing

### Test Cases

1. **Matched trace** (pv.* attributes + registered storyboard)
   - Should have `registryStatus: 'matched'`
   - Should route to `storyboard-viewer`
   - Should show coverage percentage

2. **Unmatched trace** (no pv.* attributes)
   - Should have `registryStatus: 'unmatched'`
   - Should route to `trace-viewer`
   - Should have 0% coverage

3. **Not registered** (pv.* attributes but no canvas file)
   - Should have `registryStatus: 'not-registered'`
   - Should route to `unmatched`

4. **Version mismatch** (requested version doesn't exist)
   - Should have `registryStatus: 'matched'` (falls back to latest)
   - Should show `versionStatus: 'fallback-to-latest'`

5. **Multiple versions** (storyboard has v1, v2, v3)
   - Should resolve to exact version if specified
   - Should resolve to latest if not specified

---

## Benefits

1. **Centralized matching** - Happens once in collector, not per renderer
2. **Rich routing info** - Renderers know exactly where to display traces
3. **Version awareness** - Automatic schema version resolution
4. **Coverage metrics** - See which nodes matched
5. **Performance** - Renderers receive enriched data, no processing needed
6. **Registry integration** - Traces know if they're registered
7. **Future-proof** - Easy to add span matching, validation, etc.

---

## Next Steps

1. Implement TraceRegistryMatcher in otel-collection-server
2. Update electron-app to provide StoryboardRegistry
3. Test with real traces
4. Add span-to-node matching logic
5. Add validation warnings
6. Update UI to show registry info
