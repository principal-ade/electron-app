import { ElectronFileSystemAdapter } from './ElectronFileSystemAdapter';
import { ElectronGitAdapter } from './ElectronGitAdapter';
import { ElectronShellAdapter } from './ElectronShellAdapter';
import { ElectronConfigAdapter } from './ElectronConfigAdapter';
export class ElectronPlatformAdapters {
    fileSystem = new ElectronFileSystemAdapter();
    git = new ElectronGitAdapter();
    shell = new ElectronShellAdapter();
    config = new ElectronConfigAdapter();
}
