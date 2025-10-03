import {
  FileSystemAdapter,
  GitAdapter,
  ShellAdapter,
} from '@principal-ai/codebase-composition';
import { ConfigFetchAdapter } from '../../shared/configs';

interface PlatformAdapters {
  fileSystem: FileSystemAdapter;
  git: GitAdapter;
  shell: ShellAdapter;
  config: ConfigFetchAdapter;
}
import { parseGitHubUrl } from '../../shared/utils/githubUrlParser';
import { ElectronConfigAdapter } from './ElectronConfigAdapter';
import { GitHubFileSystemAdapter } from './github/GitHubFileSystemAdapter';
import { GitHubGitAdapter } from './github/GitHubGitAdapter';
import { GitHubShellAdapter } from './github/GitHubShellAdapter';

// Main adapter class for GitHub repositories
export class GitHubWebAdapters implements PlatformAdapters {
  fileSystem: FileSystemAdapter;
  git: GitAdapter;
  shell: ShellAdapter;
  config: ConfigFetchAdapter;

  constructor(owner: string, repo: string, branch?: string) {
    this.fileSystem = new GitHubFileSystemAdapter(owner, repo, branch);
    this.git = new GitHubGitAdapter(owner, repo, branch);
    this.shell = new GitHubShellAdapter();
    this.config = new ElectronConfigAdapter();
  }

  static fromUrl(url: string): GitHubWebAdapters | null {
    const parsed = parseGitHubUrl(url);
    if (!parsed) return null;
    return new GitHubWebAdapters(parsed.owner, parsed.repo);
  }
}
