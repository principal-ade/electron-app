import { PackageLayerModule, FileSystemTree } from "@principal-ai/codebase-composition";
/**
 * Options for loading manifest contents
 */
interface LoadManifestOptions {
    fileSystemTree: FileSystemTree;
    fileSystemAdapter: any;
    packageModule?: PackageLayerModule;
    rootPath?: string;
}
/**
 * Load manifest file contents for package discovery
 *
 * This function:
 * 1. Uses PackageLayerModule's parsers to identify manifest files
 * 2. Reads their contents using the provided adapter
 * 3. Parses JSON files and creates appropriate fallbacks
 *
 * @returns Map of file paths to their parsed/raw contents
 */
export declare function loadManifestContents(options: LoadManifestOptions): Promise<Map<string, any>>;
export {};
//# sourceMappingURL=loadManifestContents.d.ts.map