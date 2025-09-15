/**
 * User Prompt API - Interface for MCP to request user input
 * Allows MCP tools to show prompts/dialogs and get user responses
 */
export var UserPromptAPIEvents;
(function (UserPromptAPIEvents) {
    // Request operations
    UserPromptAPIEvents["SHOW_PROMPT"] = "user-prompt:show";
    UserPromptAPIEvents["CANCEL_PROMPT"] = "user-prompt:cancel";
    // Response events
    UserPromptAPIEvents["PROMPT_RESPONSE"] = "user-prompt:response";
    UserPromptAPIEvents["PROMPT_CANCELLED"] = "user-prompt:cancelled";
    UserPromptAPIEvents["PROMPT_TIMEOUT"] = "user-prompt:timeout";
    UserPromptAPIEvents["IS_PROMPT_ACTIVE"] = "user-prompt:is-active";
})(UserPromptAPIEvents || (UserPromptAPIEvents = {}));
