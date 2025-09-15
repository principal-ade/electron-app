import { ElectronPlatformAdapters } from "./ElectronPlatformAdapters";
import { GitHubWebAdapters } from "./GitHubWebAdapters";
/**
 * A source-aware filesystem adapter that automatically handles path resolution
 * based on the source type (local vs GitHub) and provides a unified interface
 * for reading files from either source.
 */
export class SourceFileSystemAdapter {
    source;
    electronAdapter;
    githubAdapter;
    constructor(source, adapters) {
        this.source = source;
        // Use provided adapters or create new ones
        this.electronAdapter = adapters?.electron?.fileSystem || new ElectronPlatformAdapters().fileSystem;
        // For GitHub adapter, use location as branch when locationType is 'branch'
        const branch = source.locationType === 'branch' ? source.location : 'main';
        this.githubAdapter = adapters?.github?.fileSystem ||
            new GitHubWebAdapters(source.owner, source.name, branch).fileSystem;
    }
    /**
     * Read a file, automatically handling path resolution based on source type
     * @param path - Relative path from repo root (e.g., "package.json", "src/index.ts")
     */
    async readFile(path) {
        if (this.source.type === 'local') {
            // For local sources, convert relative path to absolute
            const absolutePath = this.resolveLocalPath(path);
            console.debug(`[SourceFileSystemAdapter] Reading local file: ${path} -> ${absolutePath}`);
            return this.electronAdapter.readFile(absolutePath);
        }
        else {
            // For GitHub sources, use the relative path directly
            console.debug(`[SourceFileSystemAdapter] Reading GitHub file: ${path}`);
            return this.githubAdapter.readFile(path);
        }
    }
    /**
     * Check if a file exists
     */
    async fileExists(path) {
        if (this.source.type === 'local') {
            const absolutePath = this.resolveLocalPath(path);
            return this.electronAdapter.fileExists ?
                this.electronAdapter.fileExists(absolutePath) : false;
        }
        else {
            return this.githubAdapter.fileExists ?
                this.githubAdapter.fileExists(path) : false;
        }
    }
    /**
     * Read a directory's contents
     */
    async readDirectory(path) {
        if (this.source.type === 'local') {
            const absolutePath = this.resolveLocalPath(path);
            return this.electronAdapter.readDirectory ?
                this.electronAdapter.readDirectory(absolutePath) : [];
        }
        else {
            return this.githubAdapter.readDirectory ?
                this.githubAdapter.readDirectory(path) : [];
        }
    }
    /**
     * Check if a path is a directory
     */
    async isDirectory(path) {
        if (this.source.type === 'local') {
            const absolutePath = this.resolveLocalPath(path);
            return this.electronAdapter.isDirectory ?
                this.electronAdapter.isDirectory(absolutePath) : false;
        }
        else {
            return this.githubAdapter.isDirectory ?
                this.githubAdapter.isDirectory(path) : false;
        }
    }
    /**
     * Get file statistics
     */
    async getFileStats(path) {
        if (this.source.type === 'local') {
            const absolutePath = this.resolveLocalPath(path);
            return this.electronAdapter.getFileStats ?
                this.electronAdapter.getFileStats(absolutePath) : null;
        }
        else {
            return this.githubAdapter.getFileStats ?
                this.githubAdapter.getFileStats(path) : null;
        }
    }
    /**
     * Resolve a relative path to an absolute path for local sources
     */
    resolveLocalPath(relativePath) {
        // If already absolute, return as-is
        if (relativePath.startsWith('/')) {
            return relativePath;
        }
        // Get the base location from source
        const base = this.source.location;
        if (!base) {
            throw new Error('Local source missing location property');
        }
        // Clean up the paths and join them
        const cleanBase = base.replace(/\/$/, ''); // Remove trailing slash
        const cleanRelative = relativePath.replace(/^\/+/, ''); // Remove leading slashes
        return `${cleanBase}/${cleanRelative}`;
    }
    /**
     * Create a simple file reader function for use with PackageLayerModule
     * This returns just the content string, not the wrapper object
     */
    createFileReader() {
        return async (path) => {
            const result = await this.readFile(path);
            return result?.content || '';
        };
    }
    /**
     * Build filtered file tree - delegates to the appropriate adapter
     */
    async buildFilteredFileTree(directoryPath, patterns, sourceDirectory) {
        if (this.source.type === 'local') {
            const absolutePath = this.resolveLocalPath(directoryPath);
            return this.electronAdapter.buildFilteredFileTree(absolutePath, patterns, sourceDirectory);
        }
        else {
            return this.githubAdapter.buildFilteredFileTree(directoryPath, patterns, sourceDirectory);
        }
    }
}
