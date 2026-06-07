/**
 * Catalog of the 30 documented Claude hook events, grouped into the same
 * families used by the source-of-truth array in
 * `@principal-ai/agent-monitoring` (`CLAUDE_HOOK_TYPES` in agent-config.ts).
 *
 * Kept local (rather than imported) so the coverage-board prototype renders the
 * full 30 even when the installed copy of agent-monitoring is an older build
 * that still exports only 10 events. Display names + descriptions mirror
 * `getHookTypeDisplayName` / `getHookTypeDescription`.
 *
 * Audit context: topic "Claude Hooks Audit" — the registration array drifted to
 * 10 of the 30 documented events. The five `isNew` entries below are the
 * net-new events wired end-to-end in agent-monitoring 0.3.13.
 */

export interface HookEventSpec {
  /** Canonical event name as it appears in `hook_event_name`. */
  name: string;
  /** Human label for the tile. */
  displayName: string;
  /** One-line description (tooltip). */
  description: string;
  /** Family the event belongs to. */
  family: HookFamily;
  /** True for the five events added end-to-end in 0.3.13 (the audit win). */
  isNew?: boolean;
}

export type HookFamily =
  | 'Session lifecycle'
  | 'Prompt'
  | 'Tool'
  | 'Permission'
  | 'Notification / display'
  | 'Subagent'
  | 'Task / team'
  | 'Stop'
  | 'System'
  | 'Worktree'
  | 'Compaction'
  | 'MCP elicitation';

export const HOOK_EVENT_CATALOG: HookEventSpec[] = [
  // Session lifecycle
  { name: 'SessionStart', displayName: 'Session Start', family: 'Session lifecycle', description: 'Runs when a session starts' },
  { name: 'Setup', displayName: 'Setup', family: 'Session lifecycle', description: 'Runs on --init/--maintenance setup', isNew: true },
  { name: 'SessionEnd', displayName: 'Session End', family: 'Session lifecycle', description: 'Runs when a session ends' },
  // Prompt
  { name: 'UserPromptSubmit', displayName: 'User Prompt Submit', family: 'Prompt', description: 'Runs when the user submits a prompt' },
  { name: 'UserPromptExpansion', displayName: 'User Prompt Expansion', family: 'Prompt', description: 'Runs when a slash command expands into a prompt', isNew: true },
  // Tool
  { name: 'PreToolUse', displayName: 'Pre Tool Use', family: 'Tool', description: 'Runs before a tool is executed' },
  { name: 'PostToolUse', displayName: 'Post Tool Use', family: 'Tool', description: 'Runs after a tool is executed' },
  { name: 'PostToolUseFailure', displayName: 'Post Tool Use Failure', family: 'Tool', description: 'Runs after a tool fails' },
  { name: 'PostToolBatch', displayName: 'Post Tool Batch', family: 'Tool', description: 'Runs after a batch of parallel tool calls resolves', isNew: true },
  // Permission
  { name: 'PermissionRequest', displayName: 'Permission Request', family: 'Permission', description: 'Runs when user is shown a permission dialog' },
  { name: 'PermissionDenied', displayName: 'Permission Denied', family: 'Permission', description: 'Runs when a tool call is denied by the auto-mode classifier', isNew: true },
  // Notification / display
  { name: 'Notification', displayName: 'Notification', family: 'Notification / display', description: 'Handles agent notifications' },
  { name: 'MessageDisplay', displayName: 'Message Display', family: 'Notification / display', description: 'Runs while an assistant message is displayed', isNew: true },
  // Subagent
  { name: 'SubagentStart', displayName: 'Subagent Start', family: 'Subagent', description: 'Runs when a subagent is spawned' },
  { name: 'SubagentStop', displayName: 'Subagent Stop', family: 'Subagent', description: 'Runs when a subagent stops' },
  // Task / team
  { name: 'TaskCreated', displayName: 'Task Created', family: 'Task / team', description: 'Runs when a task is created' },
  { name: 'TaskCompleted', displayName: 'Task Completed', family: 'Task / team', description: 'Runs when a task is marked complete' },
  { name: 'TeammateIdle', displayName: 'Teammate Idle', family: 'Task / team', description: 'Runs when a teammate is about to go idle' },
  // Stop
  { name: 'Stop', displayName: 'Stop', family: 'Stop', description: 'Runs when the agent stops' },
  { name: 'StopFailure', displayName: 'Stop Failure', family: 'Stop', description: 'Runs when a turn ends due to an API error' },
  // System
  { name: 'InstructionsLoaded', displayName: 'Instructions Loaded', family: 'System', description: 'Runs when CLAUDE.md or rule files load into context' },
  { name: 'ConfigChange', displayName: 'Config Change', family: 'System', description: 'Runs when a configuration file changes during a session' },
  { name: 'CwdChanged', displayName: 'Cwd Changed', family: 'System', description: 'Runs when the working directory changes' },
  { name: 'FileChanged', displayName: 'File Changed', family: 'System', description: 'Runs when a watched file changes on disk' },
  // Worktree
  { name: 'WorktreeCreate', displayName: 'Worktree Create', family: 'Worktree', description: 'Runs when a git worktree is created' },
  { name: 'WorktreeRemove', displayName: 'Worktree Remove', family: 'Worktree', description: 'Runs when a git worktree is removed' },
  // Compaction
  { name: 'PreCompact', displayName: 'Pre Compact', family: 'Compaction', description: 'Runs before context compaction' },
  { name: 'PostCompact', displayName: 'Post Compact', family: 'Compaction', description: 'Runs after context compaction completes' },
  // MCP elicitation
  { name: 'Elicitation', displayName: 'Elicitation', family: 'MCP elicitation', description: 'Runs when an MCP server requests user input' },
  { name: 'ElicitationResult', displayName: 'Elicitation Result', family: 'MCP elicitation', description: 'Runs when the user responds to an MCP elicitation' },
];

/** Ordered list of families as they should appear on the board. */
export const HOOK_FAMILIES: HookFamily[] = [
  'Session lifecycle',
  'Prompt',
  'Tool',
  'Permission',
  'Notification / display',
  'Subagent',
  'Task / team',
  'Stop',
  'System',
  'Worktree',
  'Compaction',
  'MCP elicitation',
];

export const TOTAL_HOOK_EVENTS = HOOK_EVENT_CATALOG.length;
