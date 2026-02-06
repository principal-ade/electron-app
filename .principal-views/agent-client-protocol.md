# Agent Client Protocol (ACP)

## Overview

The **Agent Client Protocol (ACP)** is an open standard that enables seamless communication between code editors/IDEs and AI coding agents. It solves the fragmentation problem in the agent-editor ecosystem by providing a single protocol that works across all implementations.

## The Problem

### Before ACP

Without a standard protocol:

- **N × M complexity**: Each editor needs custom integration for every agent, and vice versa
- **Limited compatibility**: Agents only work with editors they've specifically integrated with
- **Developer lock-in**: Choosing an agent restricts which editors you can use
- **Duplicated effort**: Same integration work repeated across the ecosystem

### After ACP

With a standard protocol:

- **N + M simplicity**: Each editor implements ACP once, each agent implements ACP once
- **Universal compatibility**: Any ACP-compatible editor works with any ACP-compatible agent
- **Developer freedom**: Mix and match editors and agents based on your needs
- **Ecosystem growth**: Both sides can innovate independently

## Architecture

### Core Components

#### 1. Code Editor / IDE (Client)

**Role**: The user's primary interface

- Examples: VS Code, Zed, JetBrains, your Electron app
- Uses `ClientSideConnection` class from SDK
- Spawns agent processes on demand
- Maintains control over authorization
- Provides MCP server credentials to agents

#### 2. AI Coding Agent

**Role**: The autonomous coding assistant

- Examples: Claude Code, Gemini CLI, custom agents
- Uses `AgentSideConnection` class from SDK
- Runs as subprocess (local) or remote service
- Requests permissions from editor
- Connects to MCP servers for tools

#### 3. JSON-RPC Communication Layer

**Role**: The standardized protocol

- **Local deployment**: JSON-RPC over **stdio pipes** (NOT PTY!)
- **Remote deployment**: HTTP/WebSocket (work in progress)
- **Patterns**:
  - Notifications: Real-time streaming from agent to editor
  - Bidirectional requests: Permission and authorization flows
  - Session management: Multiple parallel workflows

**Important**: ACP uses structured JSON-RPC over stdin/stdout pipes, not PTY (pseudo-terminal). PTYs are for terminal emulation with raw text I/O, while ACP requires structured, type-safe messages.

## Protocol Flow

### Phase 1: Initialization

**Purpose**: Establish connection and negotiate capabilities

```json
{
  "method": "initialize",
  "params": {
    "protocolVersion": "1.0",
    "capabilities": {
      "supportsFiles": true,
      "supportsTerminal": true,
      "supportsImages": true
    },
    "clientInfo": {
      "name": "Your IDE",
      "version": "1.0.0"
    }
  }
}
```

**Agent response**:
```json
{
  "result": {
    "protocolVersion": "1.0",
    "capabilities": {
      "supportsToolCalls": true,
      "supportsStreaming": true
    },
    "agentInfo": {
      "name": "Claude Code",
      "version": "2.0.0"
    }
  }
}
```

**Key behaviors**:
- Client sends highest supported version
- Agent responds with its highest compatible version
- If no compatible version, connection closes
- Missing capabilities treated as unsupported

### Phase 2: Session Setup

**Purpose**: Create workspace for user interaction

- Editor spawns agent as subprocess (local) or connects to remote agent
- Multiple concurrent sessions supported for parallel work
- Each session maintains independent state
- Sessions can be forked, resumed, or deleted (proposed RFDs)

### Phase 3: Prompt Turn Cycle

**Purpose**: Complete interaction from user prompt to agent completion

**Flow**:

1. **User Message**
   - Client sends `session/prompt` with content (text, images, files)

2. **Agent Processing**
   - Agent forwards to language model
   - LLM generates response

3. **Output Reporting**
   - Agent sends `session/update` notifications
   - Real-time streaming to UI

4. **Tool Calls** (if needed)
   - Agent identifies required tools
   - Requests permission from editor
   - Executes approved tools
   - Reports status updates

5. **Continuation**
   - Tool results fed back to LLM
   - Repeat steps 2-5 as needed

6. **Completion**
   - Agent signals completion with `StopReason`
   - Turn ends when no more tools needed

**Cancellation**: Client can send `session/cancel` notification at any time to abort the turn.

## MCP Integration

### How ACP and MCP Work Together

**ACP handles**: Editor ↔ Agent communication
- Session management
- UI updates and streaming
- Permission flows
- Protocol versioning

**MCP handles**: Agent ↔ Tools/Resources
- File system access
- Git operations
- Database queries
- External API calls

### Integration Flow

1. **Editor configuration**:
   - Editor maintains MCP server configurations
   - Credentials stored securely

2. **Credential passing**:
   - Editor passes MCP credentials to agent during initialization
   - Agent connects directly to MCP servers

3. **Proxy for editor tools**:
   - For MCP tools provided by the editor itself
   - ACP proxies requests back to editor
   - Circumvents stdio-only limitations

4. **Tool execution**:
   - During prompt turns, agent uses MCP tools
   - Results returned through MCP protocol
   - ACP streams updates to editor UI

## TypeScript SDK

### Installation

```bash
npm install @agentclientprotocol/sdk
```

### Key Classes

#### ClientSideConnection

For building editor/IDE integrations:

```typescript
import { ClientSideConnection } from '@agentclientprotocol/sdk';

const client = new ClientSideConnection({
  // Configuration
});

// Initialize connection
await client.initialize({
  protocolVersion: '1.0',
  capabilities: { /* ... */ }
});
```

#### AgentSideConnection

For building AI agent servers:

```typescript
import { AgentSideConnection } from '@agentclientprotocol/sdk';

const agent = new AgentSideConnection({
  // Configuration
});

// Handle incoming requests
agent.onPrompt(async (prompt) => {
  // Process prompt with LLM
  // Send updates
  // Request tools
});
```

### Other Languages

SDKs also available for:
- **Python**: `python-sdk`
- **Rust**: `agent-client-protocol` (crates.io)
- **Kotlin**: `acp-kotlin`

## Integration with Your Electron App

### Current State

Your codebase already has:

✅ **MCP Support**
- `src/main/principal-mcp/PrincipalMCPBridge.ts`
- HTTP bridge on port 3043
- MCP SDK v1.11.4

✅ **Agent Management**
- `src/main/agent-management/agentConfigHandlers.ts`
- Hook configuration
- Multiple agent support (Claude, OpenCode, Cline, Droid)

✅ **Session Management**
- OpenCode integration
- `src/main/agent-session-sdk/agentSessionSdkHandlers.ts`
- Event streaming

✅ **TypeScript/Electron Architecture**
- Main process for system operations
- IPC for renderer communication
- Existing event infrastructure

### Integration Plan

#### 1. Add ACP SDK

```bash
cd /Users/griever/Developer/desktop-app/electron-app
npm install @agentclientprotocol/sdk
```

#### 2. Create ACP Bridge

Create `src/main/agent-client-protocol/ACPBridge.ts`:

```typescript
import { ClientSideConnection } from '@agentclientprotocol/sdk';
import { spawn } from 'child_process';

export class ACPBridge {
  private connections = new Map<string, ClientSideConnection>();

  async spawnAgent(agentPath: string, sessionId: string) {
    // IMPORTANT: Use stdio pipes, NOT nodepty!
    // ACP needs structured JSON-RPC, not terminal emulation
    const agentProcess = spawn(agentPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']  // stdin, stdout, stderr
    });

    // Create client connection
    const connection = new ClientSideConnection({
      input: agentProcess.stdout,   // Read from agent
      output: agentProcess.stdin    // Write to agent
    });

    // Initialize with capabilities
    await connection.initialize({
      protocolVersion: '1.0',
      capabilities: this.getCapabilities()
    });

    this.connections.set(sessionId, connection);
    return connection;
  }

  // ... more methods
}
```

#### 3. Extend Agent Configuration

Update `src/main/agent-management/agentConfigHandlers.ts`:

```typescript
// Add ACP support to agent types
export type AgentType = 'claude' | 'opencode' | 'cline' | 'droid' | 'acp';

// Add ACP configuration
export interface ACPAgentConfig {
  type: 'acp';
  agentPath: string;  // Path to ACP-compatible agent
  supportsACP: true;
  mcpServers?: MCPServerConfig[];
}
```

#### 4. Bridge with Existing Sessions

Connect ACP sessions to your event system:

```typescript
// In ACPBridge.ts
connection.onUpdate((update) => {
  // Forward to existing event infrastructure
  this.eventServer.emit('agent:update', {
    sessionId,
    content: update
  });
});
```

#### 5. Pass MCP Credentials

```typescript
// When initializing ACP agent
const mcpCredentials = this.principalMCPBridge.getCredentials();
await connection.configureMCP(mcpCredentials);
```

### Benefits for Your App

1. **Broader ecosystem access**: Use any ACP-compatible agent
2. **Future-proof architecture**: Align with emerging standard
3. **Complementary to existing work**: Enhances, doesn't replace MCP
4. **Gradual adoption**: Can support both ACP and non-ACP agents

## Key Concepts

### Capabilities

Capabilities define what each side supports:

**Editor capabilities**:
- `supportsFiles`: File operations
- `supportsTerminal`: Terminal access
- `supportsImages`: Image rendering
- `supportsAudio`: Audio playback

**Agent capabilities**:
- `supportsToolCalls`: Can request tool execution
- `supportsStreaming`: Real-time output
- `supportsCancellation`: Can abort operations

### Stop Reasons

How prompt turns end:

- `end_turn`: Natural completion
- `max_tokens`: Token limit reached
- `cancelled`: User cancelled
- `tool_use`: Waiting for tool approval
- `error`: Encountered error

### Session Modes

Proposed modes for different use cases:

- **Interactive**: Standard back-and-forth
- **Autonomous**: Agent works independently
- **Review**: Human-in-the-loop approval

## Comparison with Related Technologies

### ACP vs LSP (Language Server Protocol)

**Similarities**:
- Both standardize communication protocols
- Both eliminate N × M integration problem
- Both use JSON-RPC

**Differences**:
- LSP: Editor ↔ Language tools (autocomplete, linting)
- ACP: Editor ↔ AI agents (autonomous coding)

### ACP vs MCP (Model Context Protocol)

**They're complementary!**

- **ACP**: Editor-to-agent communication layer
- **MCP**: Agent-to-tools communication layer
- **Together**: Complete stack for AI coding assistants

## Resources

### Official Documentation
- Website: https://agentclientprotocol.com
- GitHub: https://github.com/agentclientprotocol/agent-client-protocol
- TypeScript SDK: https://github.com/agentclientprotocol/typescript-sdk

### Example Implementations
- [Gemini CLI Agent](https://github.com/google-gemini/gemini-cli) - Production example
- TypeScript SDK examples directory - Reference implementations

### Community
- GitHub Discussions
- Zulip Chat
- RFD process for proposing changes

## Next Steps

1. **Explore the SDK**: Install and read the TypeScript SDK documentation
2. **Study examples**: Review the Gemini CLI implementation
3. **Plan integration**: Design how ACP fits into your architecture
4. **Prototype**: Build a minimal ACP bridge
5. **Test**: Connect to an ACP-compatible agent
6. **Iterate**: Expand capabilities based on needs

## PTY vs ACP: Important Distinction

### When to Use PTY (nodepty)

**Keep PTY for terminal features:**
- Terminal emulation in your app
- Running interactive shells
- Build commands and CLI tools
- Raw text I/O with ANSI codes
- Your existing `terminal-service`

### When to Use ACP

**Use ACP for agent communication:**
- Editor ↔ Agent structured messages
- Session management
- Prompt/response cycles
- Type-safe JSON-RPC protocol
- Tool request/response flows

### Key Difference

```typescript
// ❌ DON'T use PTY for agents (current approach might look like this)
const ptyProcess = spawn(agentPath, args, {
  name: 'xterm-color',
  cols: 80,
  rows: 30
});
ptyProcess.on('data', (data) => {
  // Parse raw text - fragile!
  const text = data.toString();
});

// ✅ DO use ACP with stdio pipes for agents
const agentProcess = spawn(agentPath, [], {
  stdio: ['pipe', 'pipe', 'pipe']  // NOT PTY!
});
const connection = new ClientSideConnection({
  input: agentProcess.stdout,
  output: agentProcess.stdin
});
// Structured, type-safe communication
connection.onUpdate((update) => {
  // Type-safe updates
  if (update.type === 'text') {
    console.log(update.text);
  }
});
```

## Summary

The Agent Client Protocol is an emerging standard that brings the same interoperability benefits to AI coding agents that LSP brought to language tools. By implementing ACP, your Electron app can:

- Access any ACP-compatible agent
- Use structured JSON-RPC instead of raw PTY I/O
- Maintain control and security
- Leverage existing MCP infrastructure
- Align with industry direction
- Enable user choice and flexibility

**Important**: Keep your existing PTY (nodepty) implementation for terminal features, but use ACP's stdio pipe communication for agent integration.

The protocol is actively developed with a growing ecosystem of compatible editors and agents. Now is an excellent time to adopt it.
