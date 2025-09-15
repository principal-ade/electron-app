import { Flow } from '../core/flow';
import { FlowEventType, FlowEventHandler } from '../types';
export declare abstract class BaseFlowPlugin {
    protected flow: Flow;
    constructor(flow: Flow);
    protected abstract register(): void;
    protected on(event: FlowEventType, handler: FlowEventHandler): void;
    protected off(event: FlowEventType, handler: FlowEventHandler): void;
}
export interface FlowPlugin {
    register(flow: Flow): void;
}
export declare class PluginManager {
    private plugins;
    add(plugin: FlowPlugin): this;
    applyTo(flow: Flow): void;
}
//# sourceMappingURL=base-plugin.d.ts.map