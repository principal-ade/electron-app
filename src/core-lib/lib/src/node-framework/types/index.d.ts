export type ContextValue = string | number | boolean | null | undefined | ContextValue[] | {
    [key: string]: ContextValue;
};
export type Context = Record<string, ContextValue>;
export type NodeId = string;
export interface TransitionCondition {
    condition: (context: Context) => boolean;
    target: NodeId;
}
export interface NodeTransition {
    default?: NodeId;
    conditions?: TransitionCondition[];
}
export type PrepareResult<T> = T;
export type ExecuteResult<T> = T;
export interface NodeMetadata {
    id?: NodeId;
    name?: string;
    description?: string;
    tags?: string[];
}
export interface RetryConfig {
    maxRetries: number;
    delayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error, attempt: number) => boolean;
}
export interface NodeConfig {
    metadata?: NodeMetadata;
    retryConfig?: RetryConfig;
    namespace?: string;
    outputKey?: string;
    contextFilter?: (context: Context) => Context;
    errorFallback?: NodeId;
}
export declare enum FlowEventType {
    FLOW_START = "flow:start",
    FLOW_END = "flow:end",
    FLOW_ERROR = "flow:error",
    FLOW_SUCCESS = "flow:success",
    NODE_START = "node:start",
    NODE_END = "node:end",
    NODE_ERROR = "node:error",
    NODE_RETRY = "node:retry",
    NODE_SKIP = "node:skip",
    NODE_OUTPUT = "node:output",
    CONTEXT_UPDATE = "context:update"
}
export interface FlowEvent {
    type: FlowEventType;
    timestamp: Date;
    flowId: string;
    nodeId?: NodeId;
    data?: Record<string, unknown>;
    error?: Error;
}
export type FlowEventHandler = (event: FlowEvent) => void | Promise<void>;
export interface FlowConfig {
    id?: string;
    name?: string;
    description?: string;
    maxIterations?: number;
    timeout?: number;
    eventHandlers?: Map<FlowEventType, FlowEventHandler[]>;
}
export interface GraphNode {
    id: NodeId;
    label: string;
    type: 'node' | 'subflow';
    metadata?: Record<string, string | number | boolean>;
}
export interface GraphEdge {
    source: NodeId;
    target: NodeId;
    label?: string;
    condition?: string;
}
export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    metadata?: Record<string, string | number | boolean>;
}
//# sourceMappingURL=index.d.ts.map