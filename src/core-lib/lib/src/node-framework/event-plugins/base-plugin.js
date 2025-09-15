export class BaseFlowPlugin {
    constructor(flow) {
        this.flow = flow;
    }
    on(event, handler) {
        this.flow.on(event, handler);
    }
    off(event, handler) {
        this.flow.off(event, handler);
    }
}
export class PluginManager {
    constructor() {
        this.plugins = [];
    }
    add(plugin) {
        this.plugins.push(plugin);
        return this;
    }
    applyTo(flow) {
        for (const plugin of this.plugins) {
            plugin.register(flow);
        }
    }
}
//# sourceMappingURL=base-plugin.js.map