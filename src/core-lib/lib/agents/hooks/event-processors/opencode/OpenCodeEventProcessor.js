"use strict";
/**
 * OpenCode Hook Adapter
 * Handles OpenCode's Anthropic-compatible hook data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeEventProcessor = void 0;
const supported_agents_1 = require("../../../supported-agents");
const PathNormalization_1 = require("../../types/PathNormalization");
const types_1 = require("./types");
// Helper to safely extract values
function getString(value, defaultValue = '') {
    return typeof value === 'string' ? value : defaultValue;
}
function getNumber(value, defaultValue = 0) {
    return typeof value === 'number' ? value : defaultValue;
}
class OpenCodeEventProcessor {
    /**
     * Normalize OpenCode hook data into standardized format
     * OpenCode uses Anthropic-compatible hooks, so this is similar to Claude
     */
    normalize(rawData) {
        const timestamp = getNumber(rawData.timestamp, Date.now());
        let eventType = 'unknown';
        let toolName;
        let toolInput;
        let toolOutput;
        const data = {};
        // OpenCode uses Anthropic-compatible hooks
        const hookEventName = rawData.hook_event_name;
        if (hookEventName) {
            switch (hookEventName) {
                case 'PreToolUse':
                    eventType = 'pre-tool-use';
                    toolName = rawData.tool_name;
                    toolInput = rawData.tool_input;
                    break;
                case 'PostToolUse':
                    eventType = 'post-tool-use';
                    toolName = rawData.tool_name;
                    toolInput = rawData.tool_input;
                    toolOutput = rawData.tool_response;
                    break;
                case 'Notification':
                    eventType = 'notification';
                    data.message = rawData.message;
                    break;
                case 'UserPromptSubmit':
                    eventType = 'user-prompt-submit';
                    data.prompt = rawData.prompt;
                    break;
                case 'Stop':
                    eventType = 'stop';
                    data.stopHookActive = rawData.stop_hook_active;
                    break;
                case 'SubagentStop':
                    eventType = 'subagent-stop';
                    data.stopHookActive = rawData.stop_hook_active;
                    break;
                case 'PreCompact':
                    eventType = 'pre-compact';
                    data.trigger = rawData.trigger;
                    data.customInstructions = rawData.custom_instructions;
                    break;
                case 'SessionStart':
                    eventType = 'session-start';
                    data.source = rawData.source;
                    break;
            }
        }
        else {
            // Fallback for old format (if any)
            if ((0, types_1.isOpenCodeSessionStop)(rawData)) {
                eventType = 'stop';
            }
            else if ((0, types_1.isOpenCodeFileRead)(rawData)) {
                eventType = 'pre-tool-use';
                toolName = 'Read';
                toolInput = { file_path: rawData.tool_input?.file_path };
            }
            else if ((0, types_1.isOpenCodeFileEdited)(rawData)) {
                eventType = 'post-tool-use';
                toolName = 'Edit';
                toolInput = rawData.tool_input;
            }
            else if ((0, types_1.isOpenCodeWebAccess)(rawData)) {
                eventType = 'post-tool-use';
                toolName = 'WebFetch';
                toolInput = rawData.tool_input;
            }
            else if ((0, types_1.isOpenCodeToolCall)(rawData)) {
                eventType = 'pre-tool-use';
                toolName = rawData.tool_name;
                toolInput = rawData.tool_input;
            }
        }
        // Build normalized event
        const normalized = {
            eventType,
            sessionId: getString(rawData.session_id, process.env.OPENCODE_SESSION_ID || `opencode-${Date.now()}`),
            workingDirectory: getString(rawData.cwd || rawData.working_directory, process.env.OPENCODE_WORKING_DIRECTORY || process.cwd()),
            transcriptPath: getString(rawData.transcript_path),
            timestamp,
            provider: supported_agents_1.SupportedAgent.OPENCODE,
            raw: rawData,
        };
        // Add optional fields
        if (toolName)
            normalized.toolName = toolName;
        if (toolInput !== undefined)
            normalized.toolInput = toolInput;
        if (toolOutput !== undefined)
            normalized.toolOutput = toolOutput;
        if (Object.keys(data).length > 0)
            normalized.data = data;
        // Extract file paths for tool events
        if (toolName && toolInput) {
            const extractedPaths = (0, PathNormalization_1.extractFilePathsFromToolInput)(toolName, toolInput);
            if (extractedPaths.length > 0) {
                // Set operation at root level
                normalized.operation = (0, PathNormalization_1.getFileOperation)(toolName);
                // Note: We only extract paths here, normalization happens later
                // in the electron backend where we have access to git detection
                normalized.files = extractedPaths.map(path => ({
                    originalPath: path,
                    context: null, // Will be set during normalization
                    absolutePath: path, // Will be resolved during normalization
                    displayPath: path, // Will be formatted during normalization
                }));
            }
        }
        return normalized;
    }
    /**
     * Extract tool information if this is a tool event
     * @deprecated Use normalized event's toolName and toolInput
     */
    extractToolInfo(event) {
        if (event.tool_name) {
            return {
                toolName: event.tool_name,
                toolInput: event.tool_input || {},
            };
        }
        return null;
    }
}
exports.OpenCodeEventProcessor = OpenCodeEventProcessor;
