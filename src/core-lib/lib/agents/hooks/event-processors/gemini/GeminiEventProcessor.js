"use strict";
/**
 * Gemini Hook Adapter
 * Handles Gemini-specific hook data while preserving all fields
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiEventProcessor = void 0;
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
class GeminiEventProcessor {
    /**
     * Normalize Gemini hook data into standardized format
     */
    normalize(rawData) {
        const timestamp = getNumber(rawData.timestamp, Date.now());
        let eventType = 'unknown';
        let toolName;
        let toolInput;
        let toolOutput;
        const eventData = {};
        // Check hook_event_name to determine event type
        const hookEventName = rawData.hook_event_name;
        if (hookEventName) {
            switch (hookEventName) {
                case 'PreToolUse':
                    eventType = 'pre-tool-use';
                    if ((0, types_1.isGeminiPreToolUse)(rawData)) {
                        toolName = rawData.tool_name;
                        // Parse tool_use_input if it's a JSON string
                        try {
                            toolInput =
                                typeof rawData.tool_input === 'string'
                                    ? JSON.parse(rawData.tool_input)
                                    : rawData.tool_input;
                        }
                        catch {
                            toolInput = rawData.tool_input;
                        }
                    }
                    break;
                case 'PostToolUse':
                    eventType = 'post-tool-use';
                    if ((0, types_1.isGeminiPostToolUse)(rawData)) {
                        toolName = rawData.tool_name;
                        // Parse tool_use_input if it's a JSON string
                        try {
                            toolInput =
                                typeof rawData.tool_input === 'string'
                                    ? JSON.parse(rawData.tool_input)
                                    : rawData.tool_input;
                        }
                        catch {
                            toolInput = rawData.tool_input;
                        }
                        toolOutput = rawData.tool_response;
                    }
                    break;
                case 'Notification':
                    eventType = 'notification';
                    eventData.message = rawData.message;
                    break;
                case 'UserPromptSubmit':
                    eventType = 'user-prompt-submit';
                    eventData.prompt = rawData.prompt;
                    break;
                case 'Stop':
                    eventType = 'stop';
                    eventData.trigger = rawData.trigger;
                    eventData.reason = rawData.reason;
                    eventData.stopHookActive = rawData.stop_hook_active;
                    break;
                case 'SubagentStop':
                    eventType = 'subagent-stop';
                    eventData.taskId = rawData.task_id;
                    eventData.stopHookActive = rawData.stop_hook_active;
                    break;
                case 'PreCompact':
                    eventType = 'pre-compact';
                    eventData.trigger = rawData.trigger;
                    eventData.customInstructions = rawData.custom_instructions;
                    eventData.contextSize = rawData.context_size;
                    break;
                case 'SessionStart':
                    eventType = 'session-start';
                    eventData.source = rawData.source;
                    eventData.resumeFrom = rawData.resume_from;
                    break;
            }
        }
        else {
            // Fallback for old format using isGemini* functions
            if ((0, types_1.isGeminiStopHook)(rawData)) {
                eventType = 'stop';
            }
            else if ((0, types_1.isGeminiPreToolUse)(rawData)) {
                eventType = 'pre-tool-use';
                toolName = rawData.tool_name;
                toolInput = rawData.tool_input || rawData.params;
            }
            else if ((0, types_1.isGeminiPostToolUse)(rawData)) {
                eventType = 'post-tool-use';
                toolName = rawData.tool_name;
                toolInput = rawData.tool_input || rawData.params;
                toolOutput = rawData.tool_response;
            }
            else if ((0, types_1.isGeminiNotification)(rawData)) {
                eventType = 'notification';
                eventData.message = rawData.message;
            }
            else if ((0, types_1.isGeminiSubagentStop)(rawData)) {
                eventType = 'subagent-stop';
            }
            else if ((0, types_1.isGeminiPreCompact)(rawData)) {
                eventType = 'pre-compact';
                eventData.trigger = rawData.trigger;
            }
        }
        // Build normalized event
        const normalized = {
            eventType,
            sessionId: getString(rawData.session_id, process.env.GEMINI_SESSION_ID || `gemini-${Date.now()}`),
            workingDirectory: getString(rawData.working_directory, process.env.GEMINI_WORKING_DIRECTORY || process.cwd()),
            transcriptPath: getString(rawData.transcript_path),
            timestamp,
            provider: supported_agents_1.SupportedAgent.GEMINI,
            raw: rawData,
        };
        // Add optional fields
        if (toolName)
            normalized.toolName = toolName;
        if (toolInput !== undefined)
            normalized.toolInput = toolInput;
        if (toolOutput !== undefined)
            normalized.toolOutput = toolOutput;
        if (Object.keys(eventData).length > 0)
            normalized.data = eventData;
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
                toolInput: event.tool_input || event.tool_use_input || event.params || {},
            };
        }
        return null;
    }
}
exports.GeminiEventProcessor = GeminiEventProcessor;
