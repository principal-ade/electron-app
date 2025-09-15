import { BaseNode } from './base-node';
export class Node extends BaseNode {
    async executeWithRetry(prepared, context) {
        const retryConfig = this._config.retryConfig;
        if (!retryConfig || retryConfig.maxRetries <= 0) {
            return this.execute(prepared, context);
        }
        let lastError;
        let delay = retryConfig.delayMs || 1000;
        for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
            try {
                return await Promise.resolve(this.execute(prepared, context));
            }
            catch (error) {
                lastError = error;
                if (attempt === retryConfig.maxRetries) {
                    break;
                }
                if (retryConfig.shouldRetry && !retryConfig.shouldRetry(lastError, attempt)) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                if (retryConfig.backoffMultiplier) {
                    delay *= retryConfig.backoffMultiplier;
                }
            }
        }
        throw lastError;
    }
    async run(context) {
        const prepared = this.prepare(context);
        const result = await this.executeWithRetry(prepared, context);
        const nextNodeId = await this.post(result, context);
        return { result, nextNodeId };
    }
    withRetry(retryConfig) {
        this._config.retryConfig = retryConfig;
        return this;
    }
    withNamespace(namespace) {
        this._config.namespace = namespace;
        return this;
    }
    withOutputKey(key) {
        this._config.outputKey = key;
        return this;
    }
    withErrorFallback(nodeId) {
        this._config.errorFallback = nodeId;
        return this;
    }
}
export function createRetryableNode(id, prepare, execute, config = {}) {
    return new (class extends Node {
        prepare(context) {
            return prepare(this.filterContext(context));
        }
        execute(prepared, context) {
            return execute(prepared, this.filterContext(context));
        }
    })(id, config);
}
//# sourceMappingURL=node.js.map