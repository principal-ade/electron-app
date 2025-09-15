// Safe window API access utilities for System
export class SystemService {
    static async getPlatform() {
        return window.mainProcess.system.getPlatform();
    }
    static async getSystemInfo() {
        return window.mainProcess.system.getSystemInfo();
    }
    static async executeCommand(options) {
        return window.mainProcess.system.executeCommand(options);
    }
    static async openDialog(options) {
        return window.mainProcess.system.openDialog(options);
    }
    static async checkForUpdateManually() {
        return window.mainProcess.system.checkForUpdateManually();
    }
    static async restartApp() {
        return window.mainProcess.system.restartApp();
    }
}
