# Observability Integration with @a24z/observability-sdk

## Overview

The application now integrates with the `@a24z/observability-sdk` to forward RepoNormalized events from the agent monitoring pipeline to a centralized observability platform. This enables real-time monitoring, analytics, and insights into agent behavior across all sessions.

## Configuration

### Environment Variables

Set these environment variables to configure the observability integration:

```bash
# Required: Database connection
OBSERVABILITY_DATABASE_URL=postgresql://user:password@host:port/database
# or use the generic DATABASE_URL
DATABASE_URL=postgresql://user:password@host:port/database

# Optional: API configuration
OBSERVABILITY_API_KEY=your-api-key-here
OBSERVABILITY_ENDPOINT=https://observability.example.com/api

# Optional: Debug mode
DEBUG_OBSERVABILITY=true  # Enable debug logging
NODE_ENV=production       # Set environment (development/staging/production)
```

### Configuration Options

The observability integration can be configured programmatically in `AgentSessionEventProcessorV2`:

```typescript
{
  databaseUrl: string,      // Database connection URL
  apiKey: string,           // API key for authentication
  endpoint: string,         // API endpoint URL
  environment: string,      // Environment (development/staging/production)
  batchSize: number,        // Number of events to batch (default: 100)
  flushInterval: number,    // Flush interval in ms (default: 30000)
  debug: boolean           // Enable debug logging (default: false)
}
```

## Architecture

### Data Flow

1. **Event Generation**: Agents (Claude, Cursor, etc.) generate raw events
2. **Pipeline Processing**: `AgentEventPipeline` normalizes events with repository context
3. **RepoNormalized Events**: Events are enriched with:
   - Repository information (root, owner, repo, branch)
   - Normalized file paths (relative to repo)
   - Working directory context
4. **Observability Forwarding**: `ObservabilityIntegration` converts and forwards events to the SDK
5. **Centralized Storage**: Events are stored in the configured database

### Event Structure

RepoNormalized events sent to observability include:

```typescript
{
  // Session context
  sessionId: string,
  provider: 'claude' | 'cursor' | 'windsurf' | ...,
  timestamp: number,

  // Repository context
  repository: string,
  branch: string,
  normalizedWorkingDirectory: string,

  // Event details
  eventType: string,
  toolName?: string,
  toolStatus?: string,

  // File information
  files?: Array<{
    absolutePath: string,
    relativePath: string,
    repository: string,
    inRepository: boolean
  }>,

  // User/Machine context
  userId?: string,
  machineId?: string,

  // Additional data
  commandName?: string,
  commandOutput?: string,
  message?: string,
  tokenCount?: number,
  executionTime?: number
}
```

## Features

### Automatic Event Forwarding

All processed events are automatically forwarded to the observability platform:
- Tool usage events (file reads, edits, commands)
- Session lifecycle events (start, stop)
- Error events
- Custom agent events

### Batching and Performance

- Events are batched for efficient transmission (default: 100 events)
- Automatic flushing every 30 seconds (configurable)
- Non-blocking async processing
- Graceful error handling (failures don't affect main pipeline)

### Monitoring

The integration provides statistics via `getStats()`:
```typescript
{
  isInitialized: boolean,
  eventCount: number,
  errorCount: number,
  errorRate: number
}
```

## Usage

### Basic Setup

The integration is automatically initialized when `AgentSessionEventProcessorV2` starts:

```typescript
// In AgentSessionEventProcessorV2 constructor
private async initializeObservability(): Promise<void> {
  this.observability = getObservabilityIntegration({
    environment: process.env.NODE_ENV || 'development',
    debug: process.env.DEBUG_OBSERVABILITY === 'true',
    batchSize: 50,
    flushInterval: 15000
  });

  await this.observability.initialize();
}
```

### Manual Integration

For custom implementations:

```typescript
import { getObservabilityIntegration } from './observability/ObservabilityIntegration';

// Get singleton instance
const observability = getObservabilityIntegration({
  databaseUrl: 'postgresql://...',
  environment: 'production'
});

// Initialize
await observability.initialize();

// Process events
await observability.processRepoEvent(repoNormalizedEvent);

// Shutdown gracefully
await observability.shutdown();
```

### Integration with EventProcessor

Use the helper function to connect to an existing event processor:

```typescript
import { setupObservabilityForEventProcessor } from './observability/ObservabilityIntegration';

const integration = await setupObservabilityForEventProcessor(
  eventProcessor,
  { environment: 'production' }
);
```

## Error Handling

The integration includes robust error handling:
- Initialization failures are logged but don't crash the app
- Event processing errors are caught and logged
- Failed events don't block subsequent events
- Observability errors are emitted as events for monitoring

## Shutdown

The observability integration properly shuts down when the app closes:

```typescript
// In main process shutdown
await eventProcessor.shutdown(); // This calls observability.shutdown()
```

This ensures:
- All pending events are flushed
- Connections are closed cleanly
- Statistics are logged

## Debugging

Enable debug mode for detailed logging:

```bash
DEBUG_OBSERVABILITY=true npm run dev
```

This will log:
- SDK initialization details
- Event processing information
- Batch operations
- Error details

## Benefits

1. **Centralized Monitoring**: All agent events in one place
2. **Repository Context**: Events include full repository information
3. **Performance Metrics**: Track token usage, execution time, file access
4. **Error Tracking**: Monitor failures and error rates
5. **Session Analysis**: Understand agent behavior patterns
6. **Cross-Agent Insights**: Compare performance across different AI agents

## Future Enhancements

- Custom dashboards for event visualization
- Alert configuration for anomalies
- Performance optimization recommendations
- Agent behavior analytics
- Cost tracking based on token usage