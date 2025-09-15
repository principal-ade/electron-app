import { Context, NodeId, FlowConfig, FlowEventType, FlowEventHandler } from '../types';
import { AsyncNode } from './async-node';
import { Flow } from './flow';
export declare class AsyncFlow extends Flow {
    run(initialContext?: Context): Promise<Context>;
    static asyncBuilder(config?: FlowConfig): AsyncFlowBuilder;
}
type NodeData = unknown;
type NodeResult = unknown;
export declare class AsyncFlowBuilder {
    private _asyncFlow;
    private _lastNode;
    constructor(config?: FlowConfig);
    add(node: AsyncNode<NodeData, NodeResult>): this;
    addConditional(node: AsyncNode<NodeData, NodeResult>, condition: (context: Context) => boolean): this;
    setStart(nodeId: NodeId): this;
    on(event: FlowEventType, handler: FlowEventHandler): this;
    build(): AsyncFlow;
}
export {};
//# sourceMappingURL=async-flow.d.ts.map