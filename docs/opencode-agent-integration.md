# OpenCode Agent Integration Architecture

## Overview

This document outlines the integration of [OpenCode](https://github.com/sst/opencode) as a utility process within Principal ADE. OpenCode provides a mature, multi-provider AI agent backend with session management, MCP support, and a clean HTTP API.

## Why OpenCode?

Rather than building agent management from scratch, OpenCode provides:

| Feature | Benefit |
|---------|---------|
| **Multi-provider support** | Claude, OpenAI, Google, Bedrock, 15+ providers via Vercel AI SDK |
| **Session management** | Full CRUD, fork, revert, archive, persistence |
| **MCP integration** | Model Context Protocol support out of the box |
| **LSP integration** | Code intelligence for better agent understanding |
| **PTY support** | Built-in pseudo-terminal management |
| **Event streaming** | SSE-based real-time updates |
| **API-first design** | Clean REST API + OpenAPI spec |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Principal ADE (Electron)                     │
├─────────────────────────────────────────────────────────────────┤
│  Main Process                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Window Manager  │  │ OpenCode        │  │ Event Server    │  │
│  │                 │  │ Process Manager │  │ (port 3043)     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           │         ┌──────────┴──────────┐         │           │
│           │         │                     │         │           │
│           │         ▼                     │         │           │
│           │  ┌─────────────────┐          │         │           │
│           │  │ OpenCode Server │◄─────────┼─────────┤           │
│           │  │ (utility proc)  │          │         │           │
│           │  │ port: 4096      │          │         │           │
│           │  └────────┬────────┘          │         │           │
│           │           │                   │         │           │
├───────────┼───────────┼───────────────────┼─────────┼───────────┤
│  Renderer │           │                   │         │           │
│  ┌────────┴────────┐  │  ┌────────────────┴─────────┴────────┐  │
│  │ Panel System    │  │  │ Agent Session Panel               │  │
│  │ (existing)      │  │  │ - Session list                    │  │
│  └─────────────────┘  │  │ - Message stream                  │  │
│                       │  │ - Tool call visualization         │  │
│                       │  │ - Permission handling             │  │
│                       │  └───────────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Integrations                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Backlog.md      │  │ Kanban Panel    │  │ IDE Extensions  │  │
│  │ onStatusChange  │  │ (web-ade)       │  │ (VSCode, etc)   │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┴────────────────────┘           │
│                                │                                │
│                    HTTP POST to OpenCode API                    │
└─────────────────────────────────────────────────────────────────┘
```

## Utility Process Implementation

### Process Manager

Create a new service to manage the OpenCode utility process:

```typescript
// src/main/agent-management/OpenCodeProcessManager.ts

import { utilityProcess, UtilityProcess } from 'electron';
import { EventEmitter } from 'events';

interface OpenCodeConfig {
  port: number;
  hostname: string;
  directory?: string;
}

export class OpenCodeProcessManager extends EventEmitter {
  private process: UtilityProcess | null = null;
  private config: OpenCodeConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: OpenCodeConfig = { port: 4096, hostname: '127.0.0.1' }) {
    super();
    this.config = config;
  }

  async start(directory?: string): Promise<void> {
    if (this.process) {
      throw new Error('OpenCode process already running');
    }

    // OpenCode can be spawned as a utility process
    // Option 1: Bundle OpenCode binary
    // Option 2: Use node with OpenCode package
    this.process = utilityProcess.fork(
      require.resolve('opencode-ai/bin/opencode'),
      ['serve', '--port', String(this.config.port)],
      {
        env: {
          ...process.env,
          OPENCODE_DIRECTORY: directory ?? process.cwd(),
        },
      }
    );

    this.process.on('exit', (code) => {
      this.emit('exit', code);
      this.process = null;
    });

    // Wait for server to be ready
    await this.waitForReady();
    this.startHealthCheck();
  }

  async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  get baseUrl(): string {
    return `http://${this.config.hostname}:${this.config.port}`;
  }

  private async waitForReady(timeout = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`${this.baseUrl}/global/health`);
        if (res.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('OpenCode server failed to start');
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const res = await fetch(`${this.baseUrl}/global/health`);
        if (!res.ok) this.emit('unhealthy');
      } catch {
        this.emit('unhealthy');
      }
    }, 30000);
  }
}
```

### API Client

Create a typed client for interacting with OpenCode:

```typescript
// src/main/agent-management/OpenCodeClient.ts

export interface Session {
  id: string;
  title: string;
  directory: string;
  time: { created: number; updated: number };
}

export interface PromptInput {
  parts: Array<{ type: 'text'; text: string } | { type: 'image'; data: string }>;
  providerID?: string;
  modelID?: string;
  agent?: string;
}

export class OpenCodeClient {
  constructor(private baseUrl: string) {}

  async createSession(directory: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/session?directory=${encodeURIComponent(directory)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return res.json();
  }

  async sendPromptAsync(sessionId: string, input: PromptInput): Promise<void> {
    await fetch(`${this.baseUrl}/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async abortSession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/session/${sessionId}/abort`, {
      method: 'POST',
    });
  }

  subscribeToEvents(directory: string, onEvent: (event: any) => void): () => void {
    const eventSource = new EventSource(
      `${this.baseUrl}/event?directory=${encodeURIComponent(directory)}`
    );

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data);
      onEvent(event);
    };

    return () => eventSource.close();
  }
}
```

## Integration with Existing Systems

### 1. Event Server Integration

Connect OpenCode events to existing HttpEventServer:

```typescript
// In HttpEventServer or new AgentEventBridge

class AgentEventBridge {
  constructor(
    private openCodeClient: OpenCodeClient,
    private eventServer: HttpEventServer
  ) {}

  bridgeEvents(directory: string): void {
    this.openCodeClient.subscribeToEvents(directory, (event) => {
      // Transform OpenCode events to Principal ADE events
      switch (event.type) {
        case 'message.part.updated':
          this.eventServer.emit('agent:stream', {
            sessionId: event.properties.part.sessionID,
            content: event.properties.part,
          });
          break;
        case 'permission.requested':
          this.eventServer.emit('agent:permission', event.properties);
          break;
        // ... other event mappings
      }
    });
  }
}
```

### 2. Backlog.md Integration

Configure Backlog.md to notify OpenCode when task status changes:

```yaml
# In repository's .backlog/config or task frontmatter
onStatusChange: |
  curl -s -X POST "http://localhost:4096/session?directory=$(pwd)" \
    -H "Content-Type: application/json" -d '{}' | \
  jq -r '.id' | xargs -I{} \
  curl -s -X POST "http://localhost:4096/session/{}/prompt_async" \
    -H "Content-Type: application/json" \
    -d "{
      \"parts\": [{
        \"type\": \"text\",
        \"text\": \"## Task Assignment\\n\\nTask **$TASK_ID** has been moved from '$OLD_STATUS' to '$NEW_STATUS'.\\n\\n**Title:** $TASK_TITLE\\n\\nPlease review the task and begin work according to the new status.\"
      }],
      \"agent\": \"build\"
    }"
```

### 3. Kanban Panel Integration

The industry-themed Kanban panel can interact with OpenCode for task handoff:

```typescript
// In Kanban panel
async function assignTaskToAgent(task: Task, repoPath: string) {
  const openCodeUrl = 'http://localhost:4096';

  // Create or get existing session
  const session = await fetch(`${openCodeUrl}/session?directory=${repoPath}`, {
    method: 'POST',
    body: JSON.stringify({}),
  }).then(r => r.json());

  // Send task assignment prompt
  await fetch(`${openCodeUrl}/session/${session.id}/prompt_async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{
        type: 'text',
        text: `New task assigned: ${task.title}\n\nDescription: ${task.description}`,
      }],
    }),
  });

  // UI can subscribe to events for this session
  return session.id;
}
```

## Key OpenCode API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/global/health` | GET | Health check |
| `/session` | POST | Create new session |
| `/session/:id` | GET | Get session info |
| `/session/:id/message` | POST | Send prompt (streaming) |
| `/session/:id/prompt_async` | POST | Send prompt (async, returns immediately) |
| `/session/:id/abort` | POST | Cancel active operation |
| `/event` | GET (SSE) | Subscribe to all events |
| `/permission` | GET | List pending permissions |
| `/session/:id/permissions/:permId` | POST | Respond to permission |

## Event Types

OpenCode emits these events via SSE:

- `session.created` / `session.updated` / `session.deleted`
- `message.part.updated` - Streaming content updates
- `permission.requested` - Tool needs approval
- `session.error` - Error occurred

## Configuration

### Environment Variables

```bash
# OpenCode configuration
OPENCODE_PORT=4096
OPENCODE_HOSTNAME=127.0.0.1

# Provider API keys (OpenCode will use these)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### OpenCode Config File

OpenCode reads from `~/.config/opencode/config.json`:

```json
{
  "provider": {
    "anthropic": {
      "default": true
    }
  },
  "model": {
    "default": "claude-sonnet-4-20250514"
  }
}
```

## Implementation Phases

### Phase 1: Basic Integration
- [ ] Add OpenCode as dependency or bundled binary
- [ ] Implement OpenCodeProcessManager
- [ ] Start/stop with app lifecycle
- [ ] Basic health monitoring

### Phase 2: Event Bridge
- [ ] Connect OpenCode SSE to existing event infrastructure
- [ ] Transform events for renderer consumption
- [ ] Permission request handling via IPC

### Phase 3: UI Panel
- [ ] Create Agent Session panel
- [ ] Display session list
- [ ] Stream message content
- [ ] Tool call visualization

### Phase 4: External Integration
- [ ] Document Backlog.md hook configuration
- [ ] Kanban panel integration
- [ ] IDE extension support

## Security Considerations

1. **Local only**: OpenCode server binds to `127.0.0.1` by default
2. **No auth needed**: Local-only server doesn't require authentication
3. **Directory scoping**: Each session is scoped to a directory
4. **Permission system**: OpenCode has built-in tool permission handling

## Alternatives Considered

### 1. Claude Agent SDK directly
- Simpler, but requires building session management
- Single provider (Claude only)
- No built-in MCP/LSP support

### 2. AutoMaker architecture
- Uses Claude Agent SDK under the hood
- More coupled to Claude
- Would need to extract and adapt

### 3. Custom implementation
- Full control but significant development effort
- Would duplicate existing OpenCode functionality

**Decision**: OpenCode provides the best balance of features, maturity, and flexibility while minimizing development effort.

## References

- [OpenCode GitHub](https://github.com/sst/opencode)
- [OpenCode Docs](https://opencode.ai/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [MCP Specification](https://modelcontextprotocol.io/)
