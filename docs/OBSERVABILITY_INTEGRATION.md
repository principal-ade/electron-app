# Observability Integration with @principal-ai/observability-sdk

## Overview

The application now integrates with the `@principal-ai/observability-sdk` to forward RepoNormalized events from the agent monitoring pipeline to a Turso database for centralized observability. This enables real-time monitoring, analytics, and insights into agent behavior across all sessions.

## Configuration

### UI Configuration

The observability integration can be configured through the application UI:

1. Click the **Activity** button in the main window titlebar
2. Enter your Turso database configuration:
   - **Turso Database URL**: Your Turso database URL (e.g., `libsql://your-db.turso.io`)
   - **Auth Token**: Your Turso authentication token (optional for local databases)
3. Click **Test Connection** to verify connectivity
4. Click **Save** to store the configuration securely

The configuration is stored encrypted in the SecretManager and persists across application restarts.

### Environment Variables (Alternative)

You can also configure the integration using environment variables:

```bash
# Turso Database Configuration
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Optional: Debug mode
DEBUG_OBSERVABILITY=true  # Enable debug logging
NODE_ENV=production       # Set environment (development/staging/production)
```

### Configuration Options

The observability integration supports these configuration options:

```typescript
{
  tursoUrl: string,         // Turso database URL (required)
  tursoAuthToken?: string,  // Turso auth token (optional for local)
  environment: string,      // Environment (development/staging/production)
  enabled: boolean,         // Enable/disable observability
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
4. **Observability Forwarding**: `ObservabilityIntegration` forwards events to the Turso SDK
5. **Turso Storage**: Events are stored in SQLite-based Turso database with automatic table creation

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

### Automatic Table Creation

The Turso SDK automatically creates all required tables on first connection:
- `sessions` - Session metadata and statistics
- `session_start_logs` - Session start events
- `session_end_logs` - Session end events
- `user_prompt_logs` - User prompts and interactions
- `pre_hook_logs` - Tool invocation events
- `post_hook_logs` - Tool completion events
- `stop_logs` - Stop events
- `subagent_stop_logs` - Subagent stop events
- `notification_logs` - System notifications

### Automatic Event Forwarding

All processed events are automatically forwarded to the observability platform:
- Tool usage events (file reads, edits, commands)
- Session lifecycle events (start, stop)
- User prompts and interactions
- Error events
- Custom agent events

### Performance

- Non-blocking async processing
- SQLite-based Turso for high performance
- Graceful error handling (failures don't affect main pipeline)
- Automatic connection management

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

The integration is manually initialized when configuration is provided through the UI:

```typescript
// Configuration is stored in SecretManager and loaded on initialization
const observability = getObservabilityIntegration();

// Initialize when configuration is available
await observability.initialize();
```

The integration does NOT start automatically on app startup - it requires explicit configuration through the UI or environment variables.

### Manual Integration

For custom implementations:

```typescript
import { getObservabilityIntegration } from './observability/ObservabilityIntegration';

// Get singleton instance
const observability = getObservabilityIntegration();

// Configure and save settings
await observability.saveConfiguration({
  tursoUrl: 'libsql://your-db.turso.io',
  tursoAuthToken: 'your-auth-token',
  enabled: true
});

// Initialize (creates tables automatically)
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

## Testing Connection

To test the Turso database connection:

1. Click the **Activity** button in the titlebar
2. Enter your Turso database credentials
3. Click **Test Connection**
4. Verify the success message appears

The test will:
- Validate the connection URL format
- Connect to the Turso database
- Create tables if they don't exist
- Verify read/write permissions

## Debugging

Enable debug mode for detailed logging:

```bash
DEBUG_OBSERVABILITY=true npm run dev
```

This will log:
- SDK initialization details
- Event processing information
- Table creation operations
- Error details

## Benefits

1. **Centralized Monitoring**: All agent events in one place
2. **Repository Context**: Events include full repository information
3. **Performance Metrics**: Track token usage, execution time, file access
4. **Error Tracking**: Monitor failures and error rates
5. **Session Analysis**: Understand agent behavior patterns
6. **Cross-Agent Insights**: Compare performance across different AI agents

## Turso Database

### What is Turso?

Turso is a SQLite-based database platform that provides:
- Edge database capabilities with global replication
- SQLite compatibility with cloud features
- Low-latency data access
- Built-in data encryption

### Setting up Turso

1. Create a Turso account at https://turso.tech
2. Create a new database or use an existing one
3. Get your database URL and auth token from the Turso dashboard
4. Configure the app using the Activity button in the titlebar

### Database Schema

The observability integration automatically creates the following tables:
- **sessions**: Stores session metadata including start/end times and statistics
- **session_start_logs**: Records session initialization events
- **session_end_logs**: Records session completion events
- **user_prompt_logs**: Stores user prompts with token counts
- **pre_hook_logs**: Records tool invocation events
- **post_hook_logs**: Records tool completion events with results
- **stop_logs**: Records stop events during sessions
- **subagent_stop_logs**: Records subagent stop events
- **notification_logs**: Stores system notifications and messages

## Future Enhancements

- Real-time event streaming to UI
- Custom dashboards for event visualization
- Alert configuration for anomalies
- Performance optimization recommendations
- Agent behavior analytics
- Cost tracking based on token usage
- Export capabilities for analytics tools