"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFilePath = exports.isStopEvent = exports.isToolEvent = exports.isNormalizedAgentSessionEvent = exports.isOpenCodeSessionStop = exports.isOpenCodeWebAccess = exports.isOpenCodeFileEdited = exports.isOpenCodeFileRead = exports.isOpenCodeToolCall = exports.OPENCODE_TOOLS = exports.OpenCodeEventProcessor = exports.isGeminiPreCompact = exports.isGeminiSubagentStop = exports.isGeminiNotification = exports.isGeminiStopHook = exports.isGeminiPostToolUse = exports.isGeminiPreToolUse = exports.GEMINI_TOOLS = exports.GeminiEventProcessor = exports.isClaudeStopHook = exports.isClaudePostToolUse = exports.isClaudePreToolUse = exports.CLAUDE_TOOLS = exports.ClaudeEventProcessor = void 0;
/**
 * Hook Adapters and Types
 * Export all adapters and types for use by electron app and other consumers
 */
const ClaudeEventProcessor_1 = require("./claude/ClaudeEventProcessor");
Object.defineProperty(exports, "ClaudeEventProcessor", { enumerable: true, get: function () { return ClaudeEventProcessor_1.ClaudeEventProcessor; } });
const types_1 = require("./claude/types");
Object.defineProperty(exports, "CLAUDE_TOOLS", { enumerable: true, get: function () { return types_1.CLAUDE_TOOLS; } });
Object.defineProperty(exports, "isClaudePreToolUse", { enumerable: true, get: function () { return types_1.isClaudePreToolUse; } });
Object.defineProperty(exports, "isClaudePostToolUse", { enumerable: true, get: function () { return types_1.isClaudePostToolUse; } });
Object.defineProperty(exports, "isClaudeStopHook", { enumerable: true, get: function () { return types_1.isClaudeStopHook; } });
const GeminiEventProcessor_1 = require("./gemini/GeminiEventProcessor");
Object.defineProperty(exports, "GeminiEventProcessor", { enumerable: true, get: function () { return GeminiEventProcessor_1.GeminiEventProcessor; } });
const types_2 = require("./gemini/types");
Object.defineProperty(exports, "GEMINI_TOOLS", { enumerable: true, get: function () { return types_2.GEMINI_TOOLS; } });
Object.defineProperty(exports, "isGeminiPreToolUse", { enumerable: true, get: function () { return types_2.isGeminiPreToolUse; } });
Object.defineProperty(exports, "isGeminiPostToolUse", { enumerable: true, get: function () { return types_2.isGeminiPostToolUse; } });
Object.defineProperty(exports, "isGeminiStopHook", { enumerable: true, get: function () { return types_2.isGeminiStopHook; } });
Object.defineProperty(exports, "isGeminiNotification", { enumerable: true, get: function () { return types_2.isGeminiNotification; } });
Object.defineProperty(exports, "isGeminiSubagentStop", { enumerable: true, get: function () { return types_2.isGeminiSubagentStop; } });
Object.defineProperty(exports, "isGeminiPreCompact", { enumerable: true, get: function () { return types_2.isGeminiPreCompact; } });
// OpenCode exports
const OpenCodeEventProcessor_1 = require("./opencode/OpenCodeEventProcessor");
Object.defineProperty(exports, "OpenCodeEventProcessor", { enumerable: true, get: function () { return OpenCodeEventProcessor_1.OpenCodeEventProcessor; } });
const types_3 = require("./opencode/types");
Object.defineProperty(exports, "OPENCODE_TOOLS", { enumerable: true, get: function () { return types_3.OPENCODE_TOOLS; } });
Object.defineProperty(exports, "isOpenCodeToolCall", { enumerable: true, get: function () { return types_3.isOpenCodeToolCall; } });
Object.defineProperty(exports, "isOpenCodeFileRead", { enumerable: true, get: function () { return types_3.isOpenCodeFileRead; } });
Object.defineProperty(exports, "isOpenCodeFileEdited", { enumerable: true, get: function () { return types_3.isOpenCodeFileEdited; } });
Object.defineProperty(exports, "isOpenCodeWebAccess", { enumerable: true, get: function () { return types_3.isOpenCodeWebAccess; } });
Object.defineProperty(exports, "isOpenCodeSessionStop", { enumerable: true, get: function () { return types_3.isOpenCodeSessionStop; } });
// Normalized event types
var NormalizedAgentSessionEvent_1 = require("../types/NormalizedAgentSessionEvent");
Object.defineProperty(exports, "isNormalizedAgentSessionEvent", { enumerable: true, get: function () { return NormalizedAgentSessionEvent_1.isNormalizedAgentSessionEvent; } });
Object.defineProperty(exports, "isToolEvent", { enumerable: true, get: function () { return NormalizedAgentSessionEvent_1.isToolEvent; } });
Object.defineProperty(exports, "isStopEvent", { enumerable: true, get: function () { return NormalizedAgentSessionEvent_1.isStopEvent; } });
Object.defineProperty(exports, "extractFilePath", { enumerable: true, get: function () { return NormalizedAgentSessionEvent_1.extractFilePath; } });
