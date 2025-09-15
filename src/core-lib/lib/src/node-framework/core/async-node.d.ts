import { Context, NodeId, PrepareResult, ExecuteResult, NodeConfig, RetryConfig } from '../types';
import { BaseNode } from './base-node';
export declare abstract class AsyncNode<PrepType = unknown, ExecType = unknown> extends BaseNode<PrepType, ExecType> {
    abstract prepare(context: Context): PrepareResult<PrepType> | Promise<PrepareResult<PrepType>>;
    abstract execute(prepared: PrepType, context: Context): ExecuteResult<ExecType> | Promise<ExecuteResult<ExecType>>;
    post(result: ExecType, context: Context): Promise<NodeId | null>;
    protected executeWithRetry(prepared: PrepType, context: Context): Promise<ExecType>;
    withRetry(retryConfig: RetryConfig): this;
    withNamespace(namespace: string): this;
    withOutputKey(key: string): this;
    withErrorFallback(nodeId: NodeId): this;
    run(context: Context): Promise<{
        result: ExecType;
        nextNodeId: NodeId | null;
    }>;
}
export declare function createAsyncNode<PrepType = unknown, ExecType = unknown>(id: NodeId, prepare: (context: Context) => PrepareResult<PrepType> | Promise<PrepareResult<PrepType>>, execute: (prepared: PrepType, context: Context) => ExecuteResult<ExecType> | Promise<ExecuteResult<ExecType>>, config?: NodeConfig): AsyncNode<PrepType, ExecType>;
//# sourceMappingURL=async-node.d.ts.map