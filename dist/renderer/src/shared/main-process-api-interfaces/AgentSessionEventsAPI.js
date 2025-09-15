export var AgentSessionEventsAPIEvent;
(function (AgentSessionEventsAPIEvent) {
    AgentSessionEventsAPIEvent["SUBSCRIBE"] = "agent-session-events:subscribe";
    AgentSessionEventsAPIEvent["GET_RECENT_EVENTS"] = "agent-session-events:get-recent-events";
    AgentSessionEventsAPIEvent["GET_SESSION_EVENTS"] = "agent-session-events:get-session-events";
    AgentSessionEventsAPIEvent["CLEAR_EVENTS"] = "agent-session-events:clear-events";
    AgentSessionEventsAPIEvent["REPROCESS_ALL_EVENTS"] = "agent-session-events:reprocess-all";
    AgentSessionEventsAPIEvent["REPROCESS_SESSION_EVENTS"] = "agent-session-events:reprocess-session";
})(AgentSessionEventsAPIEvent || (AgentSessionEventsAPIEvent = {}));
