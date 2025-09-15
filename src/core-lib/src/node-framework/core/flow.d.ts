import { Context, NodeId, FlowConfig, FlowEventType, FlowEvent, FlowEventHandler, GraphData } from '../types';
import { BaseNode } from './base-node';
export declare class Flow {
    protected _id: string;
    protected _config: FlowConfig;
    protected _nodes: Map<NodeId, BaseNode<any, any>>;
    protected _startNodeId: NodeId | null;
    protected _eventHandlers: Map<FlowEventType, FlowEventHandler[]>;
    constructor(config?: FlowConfig);
    get id(): string;
    get config(): FlowConfig;
    get nodes(): Map<NodeId, BaseNode<any, any>>;
    get startNodeId(): NodeId | null;
    protected generateId(): string;
    addNode(node: BaseNode<any, any>): this;
    setStartNode(nodeId: NodeId): this;
    on(event: FlowEventType, handler: FlowEventHandler): this;
    off(event: FlowEventType, handler: FlowEventHandler): this;
    protected emit(event: FlowEvent): Promise<void>;
    protected createEvent(type: FlowEventType, nodeId?: NodeId | null, data?: any, error?: Error): FlowEvent;
    run(initialContext?: Context): Promise<Context>;
    getGraphData(): GraphData;
    static builder(): FlowBuilder;
}
export declare class FlowBuilder {
    private _flow;
    private _lastNode;
    constructor(config?: FlowConfig);
    add(node: BaseNode<any, any>): this;
    addConditional(node: BaseNode<any, any>, condition: (context: Context) => boolean): this;
    setStart(nodeId: NodeId): this;
    on(event: FlowEventType, handler: FlowEventHandler): this;
    build(): Flow;
}
//# sourceMappingURL=flow.d.ts.map