/**
 * Session API - Clean interface for session operations
 * The main process handles all storage details internally
 */
export var AgentSessionAPIEvents;
(function (AgentSessionAPIEvents) {
    // Query operations
    AgentSessionAPIEvents["GET_ACTIVE_SESSIONS"] = "sessions:get-active";
    AgentSessionAPIEvents["GET_ARCHIVED_SESSIONS"] = "sessions:get-archived";
    AgentSessionAPIEvents["GET_SESSIONS_FOR_DIRECTORY"] = "sessions:get-for-directory";
    AgentSessionAPIEvents["GET_SESSION"] = "sessions:get-session";
    AgentSessionAPIEvents["GET_SESSION_EVENTS"] = "sessions:get-events";
    // Mutations
    AgentSessionAPIEvents["DELETE_SESSION"] = "sessions:delete";
    AgentSessionAPIEvents["CLEAR_DIRECTORY_SESSIONS"] = "sessions:clear-directory";
    AgentSessionAPIEvents["UPDATE_SESSION_METADATA"] = "sessions:update-metadata";
    // Events
    AgentSessionAPIEvents["SESSION_CREATED"] = "sessions:created";
    AgentSessionAPIEvents["SESSION_UPDATED"] = "sessions:updated";
    AgentSessionAPIEvents["SESSION_DELETED"] = "sessions:deleted";
    AgentSessionAPIEvents["SESSION_ARCHIVED"] = "sessions:archived";
})(AgentSessionAPIEvents || (AgentSessionAPIEvents = {}));
