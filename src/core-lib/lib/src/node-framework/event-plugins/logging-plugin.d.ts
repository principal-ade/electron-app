import { Flow } from '../core/flow';
import { FlowEventType } from '../types';
import { BaseFlowPlugin, FlowPlugin } from './base-plugin';
export interface Logger {
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: Error, data?: any): void;
}
export declare class ConsoleLogger implements Logger {
    private prefix;
    constructor(prefix?: string);
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: Error, data?: any): void;
}
export interface LoggingPluginConfig {
    logger?: Logger;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    includeContext?: boolean;
    includeTimestamp?: boolean;
    excludeEvents?: FlowEventType[];
}
export declare class LoggingPlugin extends BaseFlowPlugin implements FlowPlugin {
    private logger;
    private config;
    constructor(flow: Flow, config?: LoggingPluginConfig);
    register(flow?: Flow): void;
    private shouldLog;
    private formatMessage;
    private handleFlowStart;
    private handleFlowEnd;
    private handleFlowError;
    private handleFlowSuccess;
    private handleNodeStart;
    private handleNodeEnd;
    private handleNodeError;
    private handleNodeRetry;
    private handleNodeOutput;
}
export declare function createLoggingPlugin(config?: LoggingPluginConfig): FlowPlugin;
//# sourceMappingURL=logging-plugin.d.ts.map