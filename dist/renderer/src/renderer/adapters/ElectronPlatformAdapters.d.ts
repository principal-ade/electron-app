import { FileSystemAdapter, GitAdapter, ShellAdapter } from "@principal-ai/codebase-composition";
import { ConfigFetchAdapter } from "../../shared/configs";
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
export declare class ElectronPlatformAdapters implements PlatformAdapters {
    fileSystem: ElectronFileSystemAdapter;
    git: ElectronGitAdapter;
    shell: ElectronShellAdapter;
    config: ElectronConfigAdapter;
}
export {};
//# sourceMappingURL=ElectronPlatformAdapters.d.ts.map