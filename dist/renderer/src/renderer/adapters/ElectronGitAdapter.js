import { GithubService } from "../main-process-api/GithubService";
import { FileSystemService } from "../main-process-api/FileSystemService";
export class ElectronGitAdapter {
    async detectRepository(path) {
        const result = await GithubService.detectRepository(path);
        return result || null;
    }
    async watchGitRepository(path) {
        const result = await FileSystemService.watchGitRepository(path);
        return result || false;
    }
    async stopWatchingGit() {
        await FileSystemService.stopWatchingGit();
    }
    onGitStatusChange(callback) {
        const unsubscribe = FileSystemService.onGitStatusChange(callback);
        return unsubscribe || (() => { });
    }
}
