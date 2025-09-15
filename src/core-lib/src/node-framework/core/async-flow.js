import { FlowEventType } from '../types';
import { AsyncNode } from './async-node';
import { Flow } from './flow';
import { Node } from './node';
export class AsyncFlow extends Flow {
    async run(initialContext = {}) {
        if (!this._startNodeId) {
            throw new Error('No start node defined');
        }
        const context = { ...initialContext };
        let currentNodeId = this._startNodeId;
        let iterations = 0;
        const maxIterations = this._config.maxIterations || 1000;
        const timeout = this._config.timeout;
        const startTime = Date.now();
        await this.emit(this.createEvent(FlowEventType.FLOW_START, undefined, { context }));
        try {
            while (currentNodeId && iterations < maxIterations) {
                if (timeout && Date.now() - startTime > timeout) {
                    throw new Error(`Flow timeout after ${timeout}ms`);
                }
                const currentNode = this._nodes.get(currentNodeId);
                if (!currentNode) {
                    throw new Error(`Node ${currentNodeId} not found`);
                }
                await this.emit(this.createEvent(FlowEventType.NODE_START, currentNodeId));
                try {
                    let nextNodeId;
                    if (currentNode instanceof AsyncNode || currentNode instanceof Node) {
                        const { result, nextNodeId: next } = await currentNode.run(context);
                        nextNodeId = next;
                        await this.emit(this.createEvent(FlowEventType.NODE_OUTPUT, currentNodeId, { result }));
                    }
                    else {
                        const prepared = await Promise.resolve(currentNode.prepare(context));
                        const result = await Promise.resolve(currentNode.execute(prepared, context));
                        nextNodeId = await Promise.resolve(currentNode.post(result, context));
                        await this.emit(this.createEvent(FlowEventType.NODE_OUTPUT, currentNodeId, { result }));
                    }
                    await this.emit(this.createEvent(FlowEventType.NODE_END, currentNodeId));
                    if (nextNodeId && currentNode.successors.has(nextNodeId)) {
                        currentNodeId = nextNodeId;
                    }
                    else {
                        currentNodeId = nextNodeId;
                    }
                }
                catch (error) {
                    await this.emit(this.createEvent(FlowEventType.NODE_ERROR, currentNodeId, undefined, error));
                    const errorFallback = currentNode.config.errorFallback;
                    if (errorFallback && this._nodes.has(errorFallback)) {
                        currentNodeId = errorFallback;
                    }
                    else {
                        throw error;
                    }
                }
                iterations++;
            }
            if (iterations >= maxIterations) {
                throw new Error(`Max iterations (${maxIterations}) reached`);
            }
            await this.emit(this.createEvent(FlowEventType.FLOW_SUCCESS, undefined, { context }));
        }
        catch (error) {
            await this.emit(this.createEvent(FlowEventType.FLOW_ERROR, undefined, undefined, error));
            throw error;
        }
        finally {
            await this.emit(this.createEvent(FlowEventType.FLOW_END, undefined, { context }));
        }
        return context;
    }
    static asyncBuilder(config = {}) {
        return new AsyncFlowBuilder(config);
    }
}
export class AsyncFlowBuilder {
    constructor(config = {}) {
        this._lastNode = null;
        this._asyncFlow = new AsyncFlow(config);
    }
    add(node) {
        this._asyncFlow.addNode(node);
        if (this._lastNode) {
            this._lastNode.addSuccessor(node);
        }
        this._lastNode = node;
        return this;
    }
    addConditional(node, condition) {
        this._asyncFlow.addNode(node);
        if (this._lastNode) {
            this._lastNode.addConditionalSuccessor(node, condition);
        }
        return this;
    }
    setStart(nodeId) {
        this._asyncFlow.setStartNode(nodeId);
        return this;
    }
    on(event, handler) {
        this._asyncFlow.on(event, handler);
        return this;
    }
    build() {
        return this._asyncFlow;
    }
}
