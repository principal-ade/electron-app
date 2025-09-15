import { Context, NodeId, NodeTransition, PrepareResult, ExecuteResult, NodeConfig, GraphNode, GraphEdge } from '../types';
export declare abstract class BaseNode<PrepType = any, ExecType = any> {
    protected _id: NodeId;
    protected _successors: Map<NodeId, BaseNode<any, any>>;
    protected _transition: NodeTransition;
    protected _config: NodeConfig;
    constructor(id: NodeId, config?: NodeConfig);
    get id(): NodeId;
    get config(): NodeConfig;
    get successors(): Map<NodeId, BaseNode<any, any>>;
    abstract prepare(context: Context): PrepareResult<PrepType> | Promise<PrepareResult<PrepType>>;
    abstract execute(prepared: PrepType, context: Context): ExecuteResult<ExecType> | Promise<ExecuteResult<ExecType>>;
    post(result: ExecType, context: Context): Promise<NodeId | null>;
    addSuccessor(node: BaseNode<any, any>): void;
    addConditionalSuccessor(node: BaseNode<any, any>, condition: (context: Context) => boolean): void;
    chain(node: BaseNode<any, any>): BaseNode<any, any>;
    conditionalChain(node: BaseNode<any, any>, condition: (context: Context) => boolean): BaseNode<any, any>;
    protected filterContext(context: Context): Context;
    getGraphNode(): GraphNode;
    getGraphEdges(): GraphEdge[];
}
export declare function createNode<PrepType = any, ExecType = any>(id: NodeId, prepare: (context: Context) => PrepareResult<PrepType>, execute: (prepared: PrepType, context: Context) => ExecuteResult<ExecType>, config?: NodeConfig): BaseNode<PrepType, ExecType>;
//# sourceMappingURL=base-node.d.ts.map