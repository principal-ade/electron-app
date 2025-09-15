import { BaseNode } from './base-node';
export class AsyncNode extends BaseNode {
    async post(result, context) {
        return super.post(result, context);
    }
    async executeWithRetry(prepared, context) {
        const retryConfig = this._config.retryConfig;
        if (!retryConfig || retryConfig.maxRetries <= 0) {
            return await this.execute(prepared, context);
        }
        let lastError;
        let delay = retryConfig.delayMs || 1000;
        for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
            try {
                return await this.execute(prepared, context);
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
    async run(context) {
        const prepared = await this.prepare(context);
        const result = await this.executeWithRetry(prepared, context);
        const nextNodeId = await this.post(result, context);
        return { result, nextNodeId };
    }
}
export function createAsyncNode(id, prepare, execute, config = {}) {
    return new (class extends AsyncNode {
        async prepare(context) {
            return await prepare(this.filterContext(context));
        }
        async execute(prepared, context) {
            return await execute(prepared, this.filterContext(context));
        }
    })(id, config);
}
//# sourceMappingURL=async-node.js.map