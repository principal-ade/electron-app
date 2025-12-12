# Hooks Configuration Refactoring Plan

## Overview
Refactoring the hooks enable/disable functionality to prepare for extraction into a standalone NPX package.

## Current State Analysis

### How Hooks Currently Work
1. **UI Layer** (`HooksToggle.tsx`)
   - User clicks toggle button
   - Calls `AgentConfigurationService.addHooksToAgent()` or `removeHooksFromAgent()`

2. **Renderer Process** (`AgentConfigurationService.ts`)
   - Forwards calls via IPC: `window.mainProcess.agentConfig.*`

3. **IPC Bridge** (`agentConfigApi.ts`)
   - Routes messages between renderer and main process

4. **Main Process** (`agentConfigHandlers.ts`)
   - Reads agent config files
   - Modifies JSON configuration
   - Uses `@principal-ai/agent-monitoring` package functions

5. **Hook Scripts** (in `dist/renderer/assets/hooks/`)
   - `claude-hook.cjs`
   - `gemini-hook.cjs`
   - `opencode-hook.cjs`

### Agent-Specific Configuration Formats

#### Claude
- **Config Path**: `~/.claude/settings.json`
- **Available Hook Events** (from official docs):
  1. **PreToolUse** - Before processing a tool call
  2. **PostToolUse** - After a tool successfully completes
  3. **Notification** - When Claude needs permission or prompt is idle 60+ seconds
  4. **UserPromptSubmit** - When user submits a prompt
  5. **Stop** - When main agent finishes responding
  6. **SubagentStop** - When a subagent (Task tool) finishes
  7. **PreCompact** - Before compact operations
  8. **SessionStart** - When starting/resuming a session
  9. **SessionEnd** - When a session ends

- **Current Implementation**: Only registers hooks for:
  - PreToolUse
  - PostToolUse
  - Notification
  - Stop
  - SubagentStop

- **MISSING HOOKS** that should be added:
  - UserPromptSubmit
  - PreCompact
  - SessionStart
  - SessionEnd

- **Structure**:
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/hook.cjs",
        "timeout": 30
      }]
    }]
  }
}
```

#### Gemini
- **Config Path**: `~/.gemini/settings.json`
- **Structure**: Similar to Claude, but with different event types
- **Status**: Will mostly stay the same

#### OpenCode
- **Config Path**: `~/.config/openCode/openCode.json`
- **Structure**:
```json
{
  "experimental": {
    "anthropicHooks": {
      "tool_call": [{
        "command": ["node", "/path/to/hook.cjs"],
        "environment": {"AGENT_HOOK_TRACK_ALL_TOOLS": "true"}
      }]
    }
  }
}
```
- **Status**: Transitioning to plugin system, needs to be mocked out

## Refactoring Goals

### Phase 1: Isolate Configuration Logic
- Extract all configuration manipulation into separate service
- Create clear interfaces for hook operations
- Mock out OpenCode with appropriate error messages

### Phase 2: Create NPX Package Interface
- Design the CLI interface for the future package
- Define the contract between app and package
- Document expected commands and responses

### Phase 3: Implementation
- Refactor existing code to use new abstractions
- Add proper error handling for OpenCode
- Ensure Gemini continues working as-is

## Target NPX Commands
```bash
# Future package usage
npx @principal-ai/agent-hooks claude-hook    # Add hooks to Claude
npx @principal-ai/agent-hooks gemini-hook    # Add hooks to Gemini
npx @principal-ai/agent-hooks opencode-hook  # Add hooks to OpenCode (will install plugin)

# With actions
npx @principal-ai/agent-hooks claude-hook --enable
npx @principal-ai/agent-hooks claude-hook --disable
npx @principal-ai/agent-hooks claude-hook --status
```

## Files to Modify

### Main Process
1. `src/main/agent-management/agentConfigHandlers.ts`
   - Add OpenCode error handling
   - Prepare for extraction

2. `src/main/agent-management/AgentConfigurationService.ts`
   - Centralize configuration logic
   - Add abstraction layer

### Shared Interfaces
3. `src/shared/main-process-api-interfaces/AgentConfigAPI.ts`
   - Update interfaces if needed

### Renderer Process
4. `src/renderer/main-process-api/AgentConfigurationService.ts`
   - Update to handle new error states

5. `src/renderer/pages/LandingPage/AgentConfigurationView/HooksToggle.tsx`
   - Handle OpenCode disabled state in UI

## Implementation Steps

1. **Document Current Implementation** ✓
   - Understand existing flow
   - Identify all touchpoints
   - Review Claude hook types from documentation

2. **Update Claude Hook Types**
   - Add missing hook types (UserPromptSubmit, PreCompact, SessionStart, SessionEnd)
   - Update CLAUDE_HOOK_TYPES constant in bundled code
   - Ensure all hooks are registered when enabling

3. **Create Abstraction Layer**
   - Design service interface
   - Separate config manipulation from IPC
   - Prepare for npx package extraction

4. **Mock OpenCode**
   - Return appropriate errors indicating plugin transition
   - Update UI to show disabled state
   - Document future plugin installation approach

5. **Test Gemini & Claude**
   - Ensure existing functionality works
   - Verify all Claude hooks are registered
   - Verify no regressions

6. **Prepare for Package Extraction**
   - Document the interface contract
   - Create migration guide
   - Define npx command structure

## Notes

### OpenCode Plugin System
- OpenCode is moving from hooks in config to a plugin-based system
- For now, we'll return errors indicating it's not supported
- Future package will handle plugin installation

### Gemini Stability
- Gemini configuration format likely to remain stable
- Keep implementation as-is for now
- May need minor adjustments in the future

### Testing Strategy
- Manual testing with each agent type
- Verify error handling for OpenCode
- Ensure Claude and Gemini continue working

## Success Criteria
1. OpenCode returns clear error messages about plugin transition
2. Gemini hooks continue to work exactly as before
3. Claude hooks continue to work exactly as before
4. Code is organized for easy extraction to NPX package
5. Clear documentation of the new architecture