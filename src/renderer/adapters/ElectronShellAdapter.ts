import { ShellAdapter } from "@principal-ai/codebase-composition";
import { ShellService } from "../main-process-api/ShellService";

export class ElectronShellAdapter implements ShellAdapter {
  async openExternal(url: string): Promise<void> {
    await ShellService.openExternal(url);
  }
}
