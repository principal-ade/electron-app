export var FlowEventType;
(function (FlowEventType) {
    FlowEventType["FLOW_START"] = "flow:start";
    FlowEventType["FLOW_END"] = "flow:end";
    FlowEventType["FLOW_ERROR"] = "flow:error";
    FlowEventType["FLOW_SUCCESS"] = "flow:success";
    FlowEventType["NODE_START"] = "node:start";
    FlowEventType["NODE_END"] = "node:end";
    FlowEventType["NODE_ERROR"] = "node:error";
    FlowEventType["NODE_RETRY"] = "node:retry";
    FlowEventType["NODE_SKIP"] = "node:skip";
    FlowEventType["NODE_OUTPUT"] = "node:output";
    FlowEventType["CONTEXT_UPDATE"] = "context:update";
})(FlowEventType || (FlowEventType = {}));
//# sourceMappingURL=index.js.map