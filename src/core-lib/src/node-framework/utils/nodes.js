import { AsyncNode } from '../core/async-node';
import { Node } from '../core/node';
export class SetContextNode extends Node {
    constructor(id, setter, config = {}) {
        super(id, config);
        this.setter = setter;
    }
    prepare(context) {
        return this.setter(context);
    }
    execute(updates, context) {
        const namespace = this._config.namespace || 'default';
        if (!context[namespace]) {
            context[namespace] = {};
        }
        Object.assign(context[namespace], updates);
    }
}
export class ConditionalNode extends Node {
    constructor(id, condition, config = {}) {
        super(id, config);
        this.condition = condition;
    }
    prepare(context) {
        return this.condition(context);
    }
    execute(_result, _context) {
        // No-op
    }
    async post(result, context) {
        const conditionResult = this.prepare(context);
        if (conditionResult && this.trueNode) {
            return this.trueNode;
        }
        else if (!conditionResult && this.falseNode) {
            return this.falseNode;
        }
        return super.post(result, context);
    }
    whenTrue(nodeId) {
        this.trueNode = nodeId;
        return this;
    }
    whenFalse(nodeId) {
        this.falseNode = nodeId;
        return this;
    }
}
export class DelayNode extends AsyncNode {
    constructor(id, delayMs, config = {}) {
        super(id, config);
        this.delayMs = delayMs;
    }
    prepare(context) {
        return typeof this.delayMs === 'function' ? this.delayMs(context) : this.delayMs;
    }
    async execute(delayMs, _context) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
}
export class TransformNode extends Node {
    constructor(id, extractor, transformer, config = {}) {
        super(id, config);
        this.extractor = extractor;
        this.transformer = transformer;
    }
    prepare(context) {
        return this.extractor(context);
    }
    execute(input, context) {
        return this.transformer(input, context);
    }
}
export class AsyncTransformNode extends AsyncNode {
    constructor(id, extractor, transformer, config = {}) {
        super(id, config);
        this.extractor = extractor;
        this.transformer = transformer;
    }
    async prepare(context) {
        return await this.extractor(context);
    }
    async execute(input, context) {
        return await this.transformer(input, context);
    }
}
export class LoggingNode extends Node {
    constructor(id, message, level = 'info', config = {}) {
        super(id, config);
        this.message = message;
        this.level = level;
    }
    prepare(context) {
        return context;
    }
    execute(context) {
        const message = typeof this.message === 'function' ? this.message(context) : this.message;
        console[this.level](`[${this.id}] ${message}`);
        return context;
    }
}
export function createSetContextNode(id, setter, config) {
    return new SetContextNode(id, setter, config);
}
export function createConditionalNode(id, condition, config) {
    return new ConditionalNode(id, condition, config);
}
export function createDelayNode(id, delayMs, config) {
    return new DelayNode(id, delayMs, config);
}
export function createTransformNode(id, extractor, transformer, config) {
    return new TransformNode(id, extractor, transformer, config);
}
export function createAsyncTransformNode(id, extractor, transformer, config) {
    return new AsyncTransformNode(id, extractor, transformer, config);
}
export function createLoggingNode(id, message, level, config) {
    return new LoggingNode(id, message, level, config);
}
