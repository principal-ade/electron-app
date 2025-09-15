import { FlowEventType } from '../types';
import { BaseFlowPlugin } from './base-plugin';
export class ConsoleLogger {
    constructor(prefix = '[Flow]') {
        this.prefix = prefix;
    }
    debug(message, data) {
        console.debug(`${this.prefix} ${message}`, data);
    }
    info(message, data) {
        console.info(`${this.prefix} ${message}`, data);
    }
    warn(message, data) {
        console.warn(`${this.prefix} ${message}`, data);
    }
    error(message, error, data) {
        console.error(`${this.prefix} ${message}`, error, data);
    }
}
export class LoggingPlugin extends BaseFlowPlugin {
    constructor(flow, config = {}) {
        const fullConfig = {
            logger: new ConsoleLogger(),
            logLevel: 'info',
            includeContext: false,
            includeTimestamp: true,
            excludeEvents: [],
            ...config,
        };
        super(flow);
        this.logger = fullConfig.logger;
        this.config = fullConfig;
        this.register();
    }
    register(flow) {
        const targetFlow = flow || this.flow;
        targetFlow.on(FlowEventType.FLOW_START, this.handleFlowStart.bind(this));
        targetFlow.on(FlowEventType.FLOW_END, this.handleFlowEnd.bind(this));
        targetFlow.on(FlowEventType.FLOW_ERROR, this.handleFlowError.bind(this));
        targetFlow.on(FlowEventType.FLOW_SUCCESS, this.handleFlowSuccess.bind(this));
        targetFlow.on(FlowEventType.NODE_START, this.handleNodeStart.bind(this));
        targetFlow.on(FlowEventType.NODE_END, this.handleNodeEnd.bind(this));
        targetFlow.on(FlowEventType.NODE_ERROR, this.handleNodeError.bind(this));
        targetFlow.on(FlowEventType.NODE_RETRY, this.handleNodeRetry.bind(this));
        targetFlow.on(FlowEventType.NODE_OUTPUT, this.handleNodeOutput.bind(this));
    }
    shouldLog(event) {
        return !this.config.excludeEvents?.includes(event.type);
    }
    formatMessage(message, event) {
        if (this.config.includeTimestamp) {
            return `[${event.timestamp.toISOString()}] ${message}`;
        }
        return message;
    }
    handleFlowStart(event) {
        if (!this.shouldLog(event))
            return;
        if (this.config.logLevel === 'error')
            return;
        const message = this.formatMessage(`Flow ${event.flowId} started`, event);
        const data = this.config.includeContext ? event.data : undefined;
        this.logger.info(message, data);
    }
    handleFlowEnd(event) {
        if (!this.shouldLog(event))
            return;
        if (this.config.logLevel === 'error')
            return;
        const message = this.formatMessage(`Flow ${event.flowId} ended`, event);
        const data = this.config.includeContext ? event.data : undefined;
        this.logger.info(message, data);
    }
    handleFlowError(event) {
        if (!this.shouldLog(event))
            return;
        const message = this.formatMessage(`Flow ${event.flowId} error`, event);
        this.logger.error(message, event.error);
    }
    handleFlowSuccess(event) {
        if (!this.shouldLog(event))
            return;
        if (this.config.logLevel === 'error')
            return;
        const message = this.formatMessage(`Flow ${event.flowId} completed successfully`, event);
        const data = this.config.includeContext ? event.data : undefined;
        this.logger.info(message, data);
    }
    handleNodeStart(event) {
        if (!this.shouldLog(event))
            return;
        if (this.config.logLevel === 'error')
            return;
        const message = this.formatMessage(`Node ${event.nodeId} started`, event);
        this.logger.debug(message);
    }
    handleNodeEnd(event) {
        if (!this.shouldLog(event))
            return;
        if (this.config.logLevel === 'error')
            return;
        const message = this.formatMessage(`Node ${event.nodeId} completed`, event);
        this.logger.debug(message);
    }
    handleNodeError(event) {
        if (!this.shouldLog(event))
            return;
        const message = this.formatMessage(`Node ${event.nodeId} error`, event);
        this.logger.error(message, event.error);
    }
    handleNodeRetry(event) {
        if (!this.shouldLog(event))
            return;
        const message = this.formatMessage(`Node ${event.nodeId} retry attempt`, event);
        this.logger.warn(message, event.data);
    }
    handleNodeOutput(event) {
        if (!this.shouldLog(event))
            return;
        if (this.config.logLevel !== 'debug')
            return;
        const message = this.formatMessage(`Node ${event.nodeId} output`, event);
        this.logger.debug(message, event.data);
    }
}
export function createLoggingPlugin(config) {
    return {
        register(flow) {
            new LoggingPlugin(flow, config);
        },
    };
}
