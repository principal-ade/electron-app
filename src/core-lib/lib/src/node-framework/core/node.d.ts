import { Context, NodeId, PrepareResult, ExecuteResult, NodeConfig, RetryConfig } from '../types';
import { BaseNode } from './base-node';
export declare abstract class Node<PrepType = any, ExecType = any> extends BaseNode<PrepType, ExecType> {
    abstract prepare(context: Context): PrepareResult<PrepType>;
    abstract execute(prepared: PrepType, context: Context): ExecuteResult<ExecType>;
    protected executeWithRetry(prepared: PrepType, context: Context): Promise<ExecType>;
    run(context: Context): Promise<{
        result: ExecType;
        nextNodeId: NodeId | null;
    }>;
    withRetry(retryConfig: RetryConfig): this;
    withNamespace(namespace: string): this;
    withOutputKey(key: string): this;
    withErrorFallback(nodeId: NodeId): this;
}
export declare function createRetryableNode<PrepType = any, ExecType = any>(id: NodeId, prepare: (context: Context) => PrepareResult<PrepType>, execute: (prepared: PrepType, context: Context) => ExecuteResult<ExecType>, config?: NodeConfig): Node<PrepType, ExecType>;
//# sourceMappingURL=node.d.ts.map