/**
 * Hook Adapters and Types
 * Export all adapters and types for use by electron app and other consumers
 */
import { ClaudeEventProcessor } from './claude/ClaudeEventProcessor';
import { CLAUDE_TOOLS, isClaudePreToolUse, isClaudePostToolUse, isClaudeStopHook, } from './claude/types';
export { ClaudeEventProcessor };
export { CLAUDE_TOOLS, isClaudePreToolUse, isClaudePostToolUse, isClaudeStopHook };
import { GeminiEventProcessor } from './gemini/GeminiEventProcessor';
import { GEMINI_TOOLS, isGeminiPreToolUse, isGeminiPostToolUse, isGeminiStopHook, isGeminiNotification, isGeminiSubagentStop, isGeminiPreCompact, } from './gemini/types';
export { GeminiEventProcessor };
export { GEMINI_TOOLS, isGeminiPreToolUse, isGeminiPostToolUse, isGeminiStopHook, isGeminiNotification, isGeminiSubagentStop, isGeminiPreCompact, };
// OpenCode exports
import { OpenCodeEventProcessor } from './opencode/OpenCodeEventProcessor';
import { OPENCODE_TOOLS, isOpenCodeToolCall, isOpenCodeFileRead, isOpenCodeFileEdited, isOpenCodeWebAccess, isOpenCodeSessionStop, } from './opencode/types';
export { OpenCodeEventProcessor };
export { OPENCODE_TOOLS, isOpenCodeToolCall, isOpenCodeFileRead, isOpenCodeFileEdited, isOpenCodeWebAccess, isOpenCodeSessionStop, };
// Normalized event types
export { isNormalizedAgentSessionEvent, isToolEvent, isStopEvent, extractFilePath, } from '../types/NormalizedAgentSessionEvent';
//# sourceMappingURL=index.js.map