# Terminal Panel Workspace Mode Proposal

## Issue

The `@principal-ade/industry-themed-terminal-panel` currently creates new terminal sessions based on `context.currentScope.repository.path` whenever a repository is selected. This behavior is problematic in workspace contexts where we want the terminal to remain in the workspace directory regardless of which repository is selected.

### Current Behavior

When a repository is selected in Alexandria Workspace:
1. The `context.currentScope.repository` object updates with the new repository
2. The terminal panel reads `context.currentScope.repository.path`
3. The terminal panel calls `actions.createTerminalSession({ cwd: repository.path })`
4. A new terminal session is created in the repository directory

### Observed Logs

```
[PanelContext] createTerminalSession called with:
{
  optionsCwd: '/Users/griever/Developer/messaging-server/control-tower-core',
  workspacePath: '/Users/griever/Developer/messaging-server',
  finalCwd: '/Users/griever/Developer/messaging-server/control-tower-core',
  repository: 'control-tower-core'
}

[PanelContext] createTerminalSession called with:
{
  optionsCwd: '/Users/griever/Developer/messaging-server/repository-traffic-controller',
  workspacePath: '/Users/griever/Developer/messaging-server',
  finalCwd: '/Users/griever/Developer/messaging-server/repository-traffic-controller',
  repository: 'repository-traffic-controller'
}
```

## Desired Behavior

In workspace contexts, the terminal should:
1. Remain in the workspace directory when repositories are selected
2. Only create new terminal sessions when explicitly requested by the user
3. Not automatically respond to repository selection events by changing directories

## Proposed Solution

Add configuration options to the terminal panel to control its directory behavior:

### Option 1: Add a `terminalScope` prop

```typescript
interface TerminalPanelProps extends PanelComponentProps {
  /**
   * Determines what directory scope the terminal should use
   * - 'repository': Use context.currentScope.repository.path (current behavior)
   * - 'workspace': Use context.currentScope.workspace.path
   * - 'auto': Use repository path if available, otherwise workspace path
   * @default 'auto'
   */
  terminalScope?: 'repository' | 'workspace' | 'auto';
}
```

Usage:
```tsx
<TerminalPanel
  context={context}
  actions={actions}
  events={events}
  terminalScope="workspace"
/>
```

### Option 2: Add a `preventAutoCreate` prop

```typescript
interface TerminalPanelProps extends PanelComponentProps {
  /**
   * Prevents the terminal from automatically creating new sessions
   * when the context changes (e.g., when a different repository is selected)
   * @default false
   */
  preventAutoCreate?: boolean;

  /**
   * Override the default directory for terminal sessions
   * If not provided, uses context.currentScope.repository.path or workspace.path
   */
  defaultDirectory?: string;
}
```

Usage:
```tsx
<TerminalPanel
  context={context}
  actions={actions}
  events={events}
  preventAutoCreate={true}
  defaultDirectory={workspace.path}
/>
```

### Option 3: Use a dedicated context property

Add a new property to the panel context that the terminal panel should respect:

```typescript
interface PanelContext {
  // ... existing properties

  /**
   * The preferred directory for terminal operations
   * Terminal panels should use this instead of deriving from currentScope
   */
  terminalDirectory?: string;
}
```

Then the host can set:
```typescript
const context = {
  // ... other context properties
  terminalDirectory: workspace.path, // or repository.path, depending on desired behavior
};
```

## Recommended Approach

**Option 1** (`terminalScope` prop) is the cleanest and most explicit:

1. ✅ Clear intent - explicitly states what scope to use
2. ✅ Backward compatible - defaults to current 'auto' behavior
3. ✅ Flexible - allows different hosts to choose their preferred behavior
4. ✅ No context pollution - doesn't add new context properties
5. ✅ Easy to implement - simple prop-based configuration

## Implementation Details

### In the Terminal Panel Package

```typescript
// panels/TerminalPanel.tsx
export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  context,
  actions,
  events,
  terminalScope = 'auto'
}) => {
  // Determine the directory based on terminalScope
  const getTerminalDirectory = useCallback(() => {
    switch (terminalScope) {
      case 'workspace':
        return context.currentScope.workspace.path;
      case 'repository':
        return context.currentScope.repository?.path || context.currentScope.workspace.path;
      case 'auto':
      default:
        return context.currentScope.repository?.path || context.currentScope.workspace.path;
    }
  }, [terminalScope, context.currentScope]);

  // Use the determined directory when creating sessions
  const createSession = useCallback(async () => {
    const directory = getTerminalDirectory();
    const sessionId = await actions.createTerminalSession({ cwd: directory });
    // ... rest of session creation logic
  }, [getTerminalDirectory, actions]);

  // IMPORTANT: Only create session on mount, not when context changes
  useEffect(() => {
    createSession();
    // Intentionally NOT including context in deps to prevent recreation on repository change
  }, []); // Only run on mount

  // ... rest of component
};
```

### In the Host Application (Alexandria Workspace)

```tsx
// alexandria-workspace/AlexandriaWorkspaceLayout.tsx
<TerminalPanelComponent
  context={context}
  actions={actions}
  events={events}
  terminalScope="workspace"
/>
```

## Migration Path

1. Add `terminalScope` prop to terminal panel (default to 'auto' for backward compatibility)
2. Update terminal panel to use the prop when determining directory
3. Update terminal panel to only create sessions on mount, not on context changes
4. Host applications can opt-in to workspace mode by passing `terminalScope="workspace"`
5. Eventually deprecate 'auto' mode and make behavior more explicit

## Benefits

- ✅ Fixes the immediate issue in Alexandria Workspace
- ✅ Maintains backward compatibility for existing users
- ✅ Provides flexibility for different use cases
- ✅ Makes terminal behavior more predictable and configurable
- ✅ Reduces unexpected terminal session creation
- ✅ Better separation of concerns between panel and host

## Alternative Workarounds (Not Recommended)

While the above solution is being implemented, temporary workarounds include:

1. ❌ Removing `repository` from `context.currentScope` - breaks other panels that need repository info
2. ❌ Changing `createTerminalSession` to ignore `options.cwd` - breaks intentional directory overrides
3. ❌ Adding a key to terminal panel to prevent remount - doesn't stop the panel from calling createTerminalSession

These workarounds have side effects and are not sustainable long-term solutions.
