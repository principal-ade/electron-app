# NPX Package Interface Specification

## Package: @principal-ai/agent-hooks-cli

This document defines the interface contract for the future NPX package that will handle agent hook configuration.

## Overview

The package will provide a CLI tool to manage hooks for various AI coding assistants (Claude, Gemini, OpenCode) without requiring users to manually edit configuration files.

## Installation & Usage

### No Installation Required (NPX)
```bash
# Direct usage via npx
npx @principal-ai/agent-hooks-cli <agent> <action> [options]
```

### Global Installation (Optional)
```bash
npm install -g @principal-ai/agent-hooks-cli
agent-hooks <agent> <action> [options]
```

## Command Structure

### Basic Syntax
```
npx @principal-ai/agent-hooks-cli <agent> <action> [options]

Arguments:
  agent    The AI agent to configure (claude, gemini, opencode)
  action   The action to perform (enable, disable, status, list)

Options:
  --hook-script <path>  Custom hook script path (optional)
  --verbose            Show detailed output
  --json               Output in JSON format
  --help               Show help information
```

## Supported Commands

### 1. Enable Hooks
```bash
# Enable hooks for Claude
npx @principal-ai/agent-hooks-cli claude enable

# Enable hooks for Gemini
npx @principal-ai/agent-hooks-cli gemini enable

# Enable hooks for OpenCode (will install plugin)
npx @principal-ai/agent-hooks-cli opencode enable
```

### 2. Disable Hooks
```bash
# Disable hooks for Claude
npx @principal-ai/agent-hooks-cli claude disable

# Disable hooks for Gemini
npx @principal-ai/agent-hooks-cli gemini disable

# Disable hooks for OpenCode (will uninstall plugin)
npx @principal-ai/agent-hooks-cli opencode disable
```

### 3. Check Status
```bash
# Check hook status for Claude
npx @principal-ai/agent-hooks-cli claude status

# Check status for all agents
npx @principal-ai/agent-hooks-cli all status
```

### 4. List Available Hooks
```bash
# List available hook types for Claude
npx @principal-ai/agent-hooks-cli claude list

# List all agents and their hook types
npx @principal-ai/agent-hooks-cli all list
```

## Output Formats

### Default Output (Human Readable)
```
✓ Claude hooks enabled successfully
  Configuration: ~/.claude/settings.json
  Hook count: 9
  Hook types: PreToolUse, PostToolUse, Notification, Stop, SubagentStop, UserPromptSubmit, PreCompact, SessionStart, SessionEnd
```

### JSON Output (--json flag)
```json
{
  "success": true,
  "agent": "claude",
  "action": "enable",
  "configPath": "~/.claude/settings.json",
  "hookCount": 9,
  "hookTypes": [
    "PreToolUse",
    "PostToolUse",
    "Notification",
    "Stop",
    "SubagentStop",
    "UserPromptSubmit",
    "PreCompact",
    "SessionStart",
    "SessionEnd"
  ]
}
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "agent": "opencode",
  "action": "enable",
  "error": "OpenCode is transitioning to a plugin-based system. Please use: npx @principal-ai/opencode-plugin install",
  "suggestion": "Use the OpenCode plugin system instead of hooks"
}
```

### Exit Codes
- `0` - Success
- `1` - General error
- `2` - Agent not supported
- `3` - Configuration file error
- `4` - Permission denied
- `5` - Agent not installed

## Package API (Programmatic Usage)

The package will also export functions for programmatic usage:

```typescript
import { HookManager } from '@principal-ai/agent-hooks-cli';

// Initialize manager
const manager = new HookManager();

// Enable hooks
const result = await manager.enableHooks('claude');

// Disable hooks
const result = await manager.disableHooks('gemini');

// Get status
const status = await manager.getStatus('claude');

// List available hooks
const hooks = await manager.listHooks('claude');
```

## Implementation Requirements

### File Structure
```
@principal-ai/agent-hooks-cli/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── HookManager.ts      # Core logic (extracted from app)
│   ├── agents/
│   │   ├── claude.ts       # Claude-specific configuration
│   │   ├── gemini.ts       # Gemini-specific configuration
│   │   └── opencode.ts     # OpenCode plugin handler
│   ├── utils/
│   │   ├── config.ts       # Configuration utilities
│   │   └── paths.ts        # Path resolution
│   └── hooks/
│       ├── claude-hook.js  # Claude hook script
│       ├── gemini-hook.js  # Gemini hook script
│       └── opencode-plugin/ # OpenCode plugin files
├── bin/
│   └── agent-hooks        # Executable script
├── package.json
└── README.md
```

### Dependencies
```json
{
  "dependencies": {
    "@principal-ai/agent-monitoring": "^1.0.0",
    "commander": "^11.0.0",
    "chalk": "^5.0.0",
    "ora": "^6.0.0"
  }
}
```

## Migration Path

### Current Implementation (in app)
```typescript
// App uses HookConfigurationManager internally
const hookManager = HookConfigurationManager.getInstance();
const result = await hookManager.addHooks(agentType);
```

### Future Implementation (using NPX package)
```typescript
// App shells out to NPX command
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function enableHooks(agentType: string) {
  const { stdout, stderr } = await execAsync(
    `npx @principal-ai/agent-hooks-cli ${agentType} enable --json`
  );

  if (stderr) throw new Error(stderr);
  return JSON.parse(stdout);
}
```

## Special Considerations

### Claude
- Must register ALL 9 hook types (including new ones)
- Config path: `~/.claude/settings.json`
- Hook script: Bundled in package

### Gemini
- Uses forked version with hook support
- Config path: `~/.gemini/settings.json`
- Different hook event names than Claude

### OpenCode
- Transitioning to plugin system
- Will install/uninstall plugin instead of modifying config
- Plugin path: `~/.config/openCode/plugins/`
- Future: Direct plugin installation via OpenCode CLI

## Testing Strategy

### Unit Tests
- Test each agent configuration separately
- Mock file system operations
- Test error scenarios

### Integration Tests
- Test with actual agent installations
- Verify hook registration
- Test hook execution

### E2E Tests
- Full workflow: enable → verify → disable
- Cross-platform testing (macOS, Linux, Windows)
- Permission handling

## Version Compatibility

| Package Version | Claude | Gemini | OpenCode |
|----------------|--------|---------|----------|
| 1.0.x          | ✓      | ✓       | Plugin   |
| 2.0.x          | ✓      | ✓       | ✓ Native |

## Release Plan

### Phase 1: Extract Core Logic
1. Copy HookConfigurationManager to package
2. Remove app-specific dependencies
3. Add CLI wrapper

### Phase 2: Package Creation
1. Set up NPM package
2. Implement CLI commands
3. Bundle hook scripts

### Phase 3: App Integration
1. Update app to use NPX commands
2. Remove internal implementation
3. Update documentation

### Phase 4: OpenCode Plugin
1. Create OpenCode plugin
2. Implement plugin installer
3. Update CLI to handle plugins

## Success Metrics

- Zero manual config file editing required
- < 3 seconds execution time
- Cross-platform compatibility
- Clear error messages
- Backwards compatibility with existing configs