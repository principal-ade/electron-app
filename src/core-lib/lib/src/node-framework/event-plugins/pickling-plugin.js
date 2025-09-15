import fs from 'fs';
import path from 'path';
import { FlowEventType } from '../types';
import { BaseFlowPlugin } from './base-plugin';
export class PicklingPlugin extends BaseFlowPlugin {
    constructor(flow, config = {}) {
        const fullConfig = {
            directory: './flow-snapshots',
            filename: (flowId, event) => `${flowId}-${event.type}-${Date.now()}.json`,
            filter: () => true,
            includeEvents: [
                FlowEventType.FLOW_START,
                FlowEventType.FLOW_END,
                FlowEventType.FLOW_ERROR,
                FlowEventType.NODE_ERROR,
            ],
            excludeKeys: [],
            ...config,
        };
        super(flow);
        this.config = fullConfig;
        this.ensureDirectory();
        this.register();
    }
    register(flow) {
        const targetFlow = flow || this.flow;
        for (const eventType of this.config.includeEvents) {
            targetFlow.on(eventType, this.handleEvent.bind(this));
        }
    }
    ensureDirectory() {
        if (!fs.existsSync(this.config.directory)) {
            fs.mkdirSync(this.config.directory, { recursive: true });
        }
    }
    async handleEvent(event) {
        try {
            const snapshot = this.createSnapshot(event);
            const filename = this.config.filename(event.flowId, event);
            const filepath = path.join(this.config.directory, filename);
            await fs.promises.writeFile(filepath, JSON.stringify(snapshot, null, 2));
        }
        catch (error) {
            console.error('Failed to save flow snapshot:', error);
        }
    }
    createSnapshot(event) {
        const snapshot = {
            timestamp: event.timestamp.toISOString(),
            flowId: event.flowId,
            eventType: event.type,
            nodeId: event.nodeId,
        };
        if (event.data?.context) {
            snapshot.context = this.filterContext(event.data.context);
        }
        if (event.error) {
            snapshot.error = {
                message: event.error.message,
                stack: event.error.stack,
                name: event.error.name,
            };
        }
        if (event.data && !event.data.context) {
            snapshot.data = event.data;
        }
        return snapshot;
    }
    filterContext(context) {
        const filtered = {};
        for (const [key, value] of Object.entries(context)) {
            if (this.config.excludeKeys?.includes(key)) {
                continue;
            }
            if (!this.config.filter(key, value)) {
                continue;
            }
            try {
                JSON.stringify(value);
                filtered[key] = value;
            }
            catch {
                filtered[key] = '[Unserializable]';
            }
        }
        return filtered;
    }
    static async loadSnapshot(filepath) {
        const content = await fs.promises.readFile(filepath, 'utf-8');
        return JSON.parse(content);
    }
    static async listSnapshots(directory, flowId) {
        const files = await fs.promises.readdir(directory);
        if (flowId) {
            return files.filter(file => file.startsWith(flowId));
        }
        return files;
    }
}
export function createPicklingPlugin(config) {
    return {
        register(flow) {
            new PicklingPlugin(flow, config);
        },
    };
}
//# sourceMappingURL=pickling-plugin.js.map