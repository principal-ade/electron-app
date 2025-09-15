export class TerminalService {
    static async list() {
        return window.mainProcess.terminal.list();
    }
    static async create(dir) {
        return window.mainProcess.terminal.create(dir);
    }
    static async getOrCreate(dir) {
        return window.mainProcess.terminal.getOrCreate(dir);
    }
    static async createWithCommand(dir, command) {
        return window.mainProcess.terminal.createWithCommand(dir, command);
    }
    static async destroy(id) {
        return window.mainProcess.terminal.destroy(id);
    }
    static async write(id, data) {
        return window.mainProcess.terminal.write(id, data);
    }
    static async onData(callback) {
        return window.mainProcess.terminal.onData(callback);
    }
    static async onExit(callback) {
        return window.mainProcess.terminal.onExit(callback);
    }
    static async popOut(id) {
        return window.mainProcess.terminal.popOut(id);
    }
    static async focusWindow(windowId) {
        return window.mainProcess.terminal.focusWindow(windowId);
    }
    static async resize(id, cols, rows) {
        return window.mainProcess.terminal.resize(id, cols, rows);
    }
    static async refresh(id) {
        return window.mainProcess.terminal.refresh(id);
    }
    static onWindowReady(callback) {
        return window.mainProcess.terminal.onWindowReady?.(callback) || (() => { });
    }
}
