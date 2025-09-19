import { GitAdapter } from '@principal-ai/codebase-composition';
import { GithubService } from '../main-process-api/GithubService';
import { FileSystemService } from '../main-process-api/FileSystemService';

export class ElectronGitAdapter implements GitAdapter {
  async detectRepository(path: string): Promise<{
    isGitRepository: boolean;
    currentBranch?: string;
    owner?: string;
    repo?: string;
  } | null> {
    const result = await GithubService.detectRepository(path);
    return result || null;
  }

  async watchGitRepository(path: string): Promise<boolean> {
    const result = await FileSystemService.watchGitRepository(path);
    return result || false;
  }

  async stopWatchingGit(): Promise<void> {
    await FileSystemService.stopWatchingGit();
  }

  onGitStatusChange(
    callback: (data: { changedFiles: any[] }) => void,
  ): () => void {
    const unsubscribe = FileSystemService.onGitStatusChange(callback);
    return unsubscribe || (() => {});
  }
}
