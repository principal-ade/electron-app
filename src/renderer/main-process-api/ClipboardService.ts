// Safe window API access utilities for Clipboard

export class ClipboardService {
  static async readText(): Promise<{ success: boolean; text: string }> {
    return window.mainProcess.clipboard.readText();
  }
  static async writeText(text: string): Promise<boolean> {
    return window.mainProcess.clipboard.writeText(text);
  }
}