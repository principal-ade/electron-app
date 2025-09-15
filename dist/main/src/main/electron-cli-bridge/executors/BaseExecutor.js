/**
 * BaseExecutor - Abstract base class for command executors
 * Provides common functionality for all specialized executors
 */
export class BaseExecutor {
    bridge;
    constructor(bridge) {
        this.bridge = bridge;
    }
    /**
     * Execute a command through the bridge
     */
    async execute(command, args = [], options = {}) {
        return this.bridge.execute(command, args, options);
    }
    /**
     * Parse command output lines into array
     */
    parseLines(output) {
        return output
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }
    /**
     * Check if a command is available
     */
    async isAvailable() {
        try {
            const result = await this.getVersion();
            return result !== null;
        }
        catch {
            return false;
        }
    }
}
