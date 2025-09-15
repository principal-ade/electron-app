export class BaseNode {
    constructor(id, config = {}) {
        this._successors = new Map();
        this._transition = {};
        this._id = id;
        this._config = config;
    }
    get id() {
        return this._id;
    }
    get config() {
        return this._config;
    }
    get successors() {
        return this._successors;
    }
    async post(result, context) {
        if (this._config.outputKey) {
            const namespace = this._config.namespace || 'default';
            if (!context[namespace] ||
                typeof context[namespace] !== 'object' ||
                Array.isArray(context[namespace])) {
                context[namespace] = {};
            }
            context[namespace][this._config.outputKey] =
                result;
        }
        if (this._transition.conditions) {
            for (const condition of this._transition.conditions) {
                if (condition.condition(context)) {
                    return condition.target;
                }
            }
        }
        return this._transition.default || null;
    }
    addSuccessor(node) {
        this._successors.set(node.id, node);
        if (!this._transition.default) {
            this._transition.default = node.id;
        }
    }
    addConditionalSuccessor(node, condition) {
        this._successors.set(node.id, node);
        if (!this._transition.conditions) {
            this._transition.conditions = [];
        }
        this._transition.conditions.push({
            condition,
            target: node.id,
        });
    }
    chain(node) {
        this.addSuccessor(node);
        return node;
    }
    conditionalChain(node, condition) {
        this.addConditionalSuccessor(node, condition);
        return this;
    }
    filterContext(context) {
        if (this._config.contextFilter) {
            return this._config.contextFilter(context);
        }
        return context;
    }
    getGraphNode() {
        return {
            id: this._id,
            label: this._config.metadata?.name || this._id,
            type: 'node',
            metadata: this._config.metadata,
        };
    }
    getGraphEdges() {
        const edges = [];
        if (this._transition.conditions) {
            for (const condition of this._transition.conditions) {
                edges.push({
                    source: this._id,
                    target: condition.target,
                    label: 'conditional',
                    condition: condition.condition.toString(),
                });
            }
        }
        if (this._transition.default) {
            edges.push({
                source: this._id,
                target: this._transition.default,
                label: 'default',
            });
        }
        return edges;
    }
}
export function createNode(id, prepare, execute, config = {}) {
    return new (class extends BaseNode {
        prepare(context) {
            return prepare(this.filterContext(context));
        }
        execute(prepared, context) {
            return execute(prepared, this.filterContext(context));
        }
    })(id, config);
}
