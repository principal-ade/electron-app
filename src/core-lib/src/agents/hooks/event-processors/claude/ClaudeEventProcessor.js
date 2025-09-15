/**
 * Claude Hook Adapter
 * Handles Claude-specific hook data while preserving all fields
 */
import { SupportedAgent } from '../../../supported-agents';
import { extractFilePathsFromToolInput, getFileOperation } from '../../types/PathNormalization';
import { isClaudePreToolUse, isClaudePostToolUse, isClaudeStopHook } from './types';
// Helper to safely extract string values
function getString(value, defaultValue = '') {
    return typeof value === 'string' ? value : defaultValue;
}
export class ClaudeEventProcessor {
    /**
     * Normalize Claude hook data into standardized format
     */
    normalize(rawData) {
        const timestamp = Date.now();
        let eventType = 'unknown';
        let toolName;
        let toolInput;
        let toolOutput;
        const data = {};
        // Check for new event types first (based on hook_event_name)
        const hookEventName = rawData.hook_event_name;
        if (hookEventName) {
            switch (hookEventName) {
                case 'PreToolUse':
                    eventType = 'pre-tool-use';
                    if (isClaudePreToolUse(rawData)) {
                        toolName = rawData.tool_name;
                        toolInput = rawData.tool_input;
                    }
                    break;
                case 'PostToolUse':
                    eventType = 'post-tool-use';
                    if (isClaudePostToolUse(rawData)) {
                        toolName = rawData.tool_name;
                        toolInput = rawData.tool_input;
                        toolOutput = rawData.tool_response;
                    }
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
                case 'claude_stop_hook':
                    // Legacy stop hook format
                    eventType = 'stop';
                    break;
            }
        }
        else if (isClaudeStopHook(rawData)) {
            // Fallback for old stop hook format
            eventType = 'stop';
        }
        else if (isClaudePreToolUse(rawData)) {
            eventType = 'pre-tool-use';
            toolName = rawData.tool_name;
            toolInput = rawData.tool_input;
        }
        else if (isClaudePostToolUse(rawData)) {
            eventType = 'post-tool-use';
            toolName = rawData.tool_name;
            toolInput = rawData.tool_input;
            toolOutput = rawData.tool_response;
        }
        // Build normalized event
        const normalized = {
            eventType,
            sessionId: getString(rawData.session_id),
            workingDirectory: getString(rawData.cwd || rawData.working_directory, process.cwd()),
            transcriptPath: getString(rawData.transcript_path),
            timestamp,
            provider: SupportedAgent.CLAUDE,
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
        const extractedPaths = [];
        if (toolName && toolInput) {
            // Extract paths from tool input (search path, file being operated on, etc.)
            const inputPaths = extractFilePathsFromToolInput(toolName, toolInput);
            extractedPaths.push(...inputPaths);
        }
        // For search tools, also extract results from toolOutput (post-tool-use only)
        if (toolName && toolOutput && eventType === 'post-tool-use') {
            const searchTools = new Set(['Glob', 'Grep', 'LS']);
            if (searchTools.has(toolName)) {
                try {
                    // Extract file paths from search results
                    if (toolName === 'Glob' && Array.isArray(toolOutput)) {
                        // Glob returns array of file paths
                        extractedPaths.push(...toolOutput.filter(path => typeof path === 'string'));
                    }
                    else if (toolName === 'Grep') {
                        // Grep can return various formats
                        if (typeof toolOutput === 'string') {
                            // Parse grep output format - look for file paths
                            const lines = toolOutput.split('\n');
                            for (const line of lines) {
                                // Common grep formats: "filename:line:content" or just "filename"
                                const match = line.match(/^([^:]+):/);
                                if (match) {
                                    extractedPaths.push(match[1]);
                                }
                            }
                        }
                        else if (Array.isArray(toolOutput)) {
                            extractedPaths.push(...toolOutput.filter(path => typeof path === 'string'));
                        }
                    }
                    else if (toolName === 'LS') {
                        // LS can return array of file/directory names
                        if (Array.isArray(toolOutput)) {
                            extractedPaths.push(...toolOutput.filter(path => typeof path === 'string'));
                        }
                    }
                }
                catch (error) {
                    console.warn(`[ClaudeEventProcessor] Failed to extract paths from ${toolName} output:`, error);
                }
            }
        }
        if (extractedPaths.length > 0) {
            // Set operation at root level
            if (toolName) {
                normalized.operation = getFileOperation(toolName);
            }
            // Note: We only extract paths here, normalization happens later
            // in the electron backend where we have access to git detection
            // IMPORTANT: Don't set displayPath here - it should only be set after successful normalization
            normalized.files = [...new Set(extractedPaths)].map(path => ({
                originalPath: path,
                context: null, // Will be set during normalization
                absolutePath: '', // Will be resolved during normalization
                displayPath: '', // Will be formatted during normalization - empty string indicates not normalized
            }));
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
                toolInput: event.tool_input,
            };
        }
        return null;
    }
}
