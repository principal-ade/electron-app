import { FlowEventType, } from '../types';
import { Node } from './node';
export class Flow {
    constructor(config = {}) {
        this._nodes = new Map();
        this._startNodeId = null;
        this._id = config.id || this.generateId();
        this._config = config;
        this._eventHandlers = config.eventHandlers || new Map();
    }
    get id() {
        return this._id;
    }
    get config() {
        return this._config;
    }
    get nodes() {
        return this._nodes;
    }
    get startNodeId() {
        return this._startNodeId;
    }
    generateId() {
        return `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    addNode(node) {
        this._nodes.set(node.id, node);
        if (!this._startNodeId) {
            this._startNodeId = node.id;
        }
        return this;
    }
    setStartNode(nodeId) {
        if (!this._nodes.has(nodeId)) {
            throw new Error(`Node ${nodeId} not found in flow`);
        }
        this._startNodeId = nodeId;
        return this;
    }
    on(event, handler) {
        if (!this._eventHandlers.has(event)) {
            this._eventHandlers.set(event, []);
        }
        this._eventHandlers.get(event).push(handler);
        return this;
    }
    off(event, handler) {
        const handlers = this._eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
        return this;
    }
    async emit(event) {
        const handlers = this._eventHandlers.get(event.type) || [];
        for (const handler of handlers) {
            await handler(event);
        }
    }
    createEvent(type, nodeId, data, error) {
        return {
            type,
            timestamp: new Date(),
            flowId: this._id,
            nodeId: nodeId || undefined,
            data,
            error,
        };
    }
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
                    if (currentNode instanceof Node) {
                        const { result, nextNodeId: next } = await currentNode.run(context);
                        nextNodeId = next;
                        await this.emit(this.createEvent(FlowEventType.NODE_OUTPUT, currentNodeId, { result }));
                    }
                    else {
                        const prepared = currentNode.prepare(context);
                        const result = await currentNode.execute(prepared, context);
                        nextNodeId = await currentNode.post(result, context);
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
    getGraphData() {
        const nodes = [];
        const edges = [];
        const processedNodes = new Set();
        const processNode = (nodeId) => {
            if (processedNodes.has(nodeId))
                return;
            processedNodes.add(nodeId);
            const node = this._nodes.get(nodeId);
            if (!node)
                return;
            nodes.push(node.getGraphNode());
            const nodeEdges = node.getGraphEdges();
            edges.push(...nodeEdges);
            for (const edge of nodeEdges) {
                if (this._nodes.has(edge.target)) {
                    processNode(edge.target);
                }
            }
        };
        if (this._startNodeId) {
            processNode(this._startNodeId);
        }
        return {
            nodes,
            edges,
            metadata: {
                flowId: this._id,
                name: this._config.name || 'Unnamed Flow',
                description: this._config.description || 'No description',
            },
        };
    }
    static builder() {
        return new FlowBuilder();
    }
}
export class FlowBuilder {
    constructor(config = {}) {
        this._lastNode = null;
        this._flow = new Flow(config);
    }
    add(node) {
        this._flow.addNode(node);
        if (this._lastNode) {
            this._lastNode.addSuccessor(node);
        }
        this._lastNode = node;
        return this;
    }
    addConditional(node, condition) {
        this._flow.addNode(node);
        if (this._lastNode) {
            this._lastNode.addConditionalSuccessor(node, condition);
        }
        return this;
    }
    setStart(nodeId) {
        this._flow.setStartNode(nodeId);
        return this;
    }
    on(event, handler) {
        this._flow.on(event, handler);
        return this;
    }
    build() {
        return this._flow;
    }
}
//# sourceMappingURL=flow.js.map