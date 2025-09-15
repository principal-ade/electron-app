// Safe window API access utilities for Clipboard
export class ClipboardService {
    static async readText() {
        return window.mainProcess.clipboard.readText();
    }
    static async writeText(text) {
        return window.mainProcess.clipboard.writeText(text);
    }
}
