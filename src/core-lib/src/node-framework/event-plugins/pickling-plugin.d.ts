import { Flow } from '../core/flow';
import { FlowEventType, FlowEvent } from '../types';
import { BaseFlowPlugin, FlowPlugin } from './base-plugin';
export interface PicklingPluginConfig {
    directory?: string;
    filename?: (flowId: string, event: FlowEvent) => string;
    filter?: (key: string, value: any) => boolean;
    includeEvents?: FlowEventType[];
    excludeKeys?: string[];
}
export declare class PicklingPlugin extends BaseFlowPlugin implements FlowPlugin {
    private config;
    constructor(flow: Flow, config?: PicklingPluginConfig);
    register(flow?: Flow): void;
    private ensureDirectory;
    private handleEvent;
    private createSnapshot;
    private filterContext;
    static loadSnapshot(filepath: string): Promise<any>;
    static listSnapshots(directory: string, flowId?: string): Promise<string[]>;
}
export declare function createPicklingPlugin(config?: PicklingPluginConfig): FlowPlugin;
//# sourceMappingURL=pickling-plugin.d.ts.map