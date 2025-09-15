import { ShellService } from "../main-process-api/ShellService";
export class ElectronShellAdapter {
    async openExternal(url) {
        await ShellService.openExternal(url);
    }
}
