import { AsyncNode } from '../core/async-node';
import { Node } from '../core/node';
import { Context, NodeId, NodeConfig } from '../types';
export declare class SetContextNode extends Node<Record<string, any>, void> {
    private setter;
    constructor(id: NodeId, setter: (context: Context) => Record<string, any>, config?: NodeConfig);
    prepare(context: Context): Record<string, any>;
    execute(updates: Record<string, any>, context: Context): void;
}
export declare class ConditionalNode extends Node<boolean, void> {
    private condition;
    private trueNode?;
    private falseNode?;
    constructor(id: NodeId, condition: (context: Context) => boolean, config?: NodeConfig);
    prepare(context: Context): boolean;
    execute(_result: boolean, _context: Context): void;
    post(result: void, context: Context): Promise<NodeId | null>;
    whenTrue(nodeId: NodeId): this;
    whenFalse(nodeId: NodeId): this;
}
export declare class DelayNode extends AsyncNode<number, void> {
    private delayMs;
    constructor(id: NodeId, delayMs: number | ((context: Context) => number), config?: NodeConfig);
    prepare(context: Context): number;
    execute(delayMs: number, _context: Context): Promise<void>;
}
export declare class TransformNode<TInput = any, TOutput = any> extends Node<TInput, TOutput> {
    private extractor;
    private transformer;
    constructor(id: NodeId, extractor: (context: Context) => TInput, transformer: (input: TInput, context: Context) => TOutput, config?: NodeConfig);
    prepare(context: Context): TInput;
    execute(input: TInput, context: Context): TOutput;
}
export declare class AsyncTransformNode<TInput = any, TOutput = any> extends AsyncNode<TInput, TOutput> {
    private extractor;
    private transformer;
    constructor(id: NodeId, extractor: (context: Context) => TInput | Promise<TInput>, transformer: (input: TInput, context: Context) => TOutput | Promise<TOutput>, config?: NodeConfig);
    prepare(context: Context): Promise<TInput>;
    execute(input: TInput, context: Context): Promise<TOutput>;
}
export declare class LoggingNode extends Node<any, any> {
    private message;
    private level;
    constructor(id: NodeId, message: string | ((context: Context) => string), level?: 'debug' | 'info' | 'warn' | 'error', config?: NodeConfig);
    prepare(context: Context): any;
    execute(context: Context): any;
}
export declare function createSetContextNode(id: NodeId, setter: (context: Context) => Record<string, any>, config?: NodeConfig): SetContextNode;
export declare function createConditionalNode(id: NodeId, condition: (context: Context) => boolean, config?: NodeConfig): ConditionalNode;
export declare function createDelayNode(id: NodeId, delayMs: number | ((context: Context) => number), config?: NodeConfig): DelayNode;
export declare function createTransformNode<TInput = any, TOutput = any>(id: NodeId, extractor: (context: Context) => TInput, transformer: (input: TInput, context: Context) => TOutput, config?: NodeConfig): TransformNode<TInput, TOutput>;
export declare function createAsyncTransformNode<TInput = any, TOutput = any>(id: NodeId, extractor: (context: Context) => TInput | Promise<TInput>, transformer: (input: TInput, context: Context) => TOutput | Promise<TOutput>, config?: NodeConfig): AsyncTransformNode<TInput, TOutput>;
export declare function createLoggingNode(id: NodeId, message: string | ((context: Context) => string), level?: 'debug' | 'info' | 'warn' | 'error', config?: NodeConfig): LoggingNode;
//# sourceMappingURL=nodes.d.ts.map