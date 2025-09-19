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
import { ElectronFileSystemAdapter } from './ElectronFileSystemAdapter';
import { ElectronGitAdapter } from './ElectronGitAdapter';
import { ElectronShellAdapter } from './ElectronShellAdapter';
import { ElectronConfigAdapter } from './ElectronConfigAdapter';

export class ElectronPlatformAdapters implements PlatformAdapters {
  fileSystem = new ElectronFileSystemAdapter();

  git = new ElectronGitAdapter();

  shell = new ElectronShellAdapter();

  config = new ElectronConfigAdapter();
}
