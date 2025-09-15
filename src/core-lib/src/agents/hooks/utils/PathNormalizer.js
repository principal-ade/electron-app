/**
 * PathNormalizer - Handles path normalization and classification
 * Used by the electron backend to normalize paths with repository context
 */
import * as path from 'path';
import { PathContext, classifyPath, isAbsolutePath, } from '../types/PathNormalization';
export class PathNormalizer {
    constructor(options) {
        this.findRepositoryRoot = options.findRepositoryRoot;
        this.homeDir = options.homeDir || '';
    }
    /**
     * Normalize a file path with full context
     */
    async normalizePath(filePath, workingDirectory) {
        // 1. Resolve to absolute path
        const absolutePath = isAbsolutePath(filePath)
            ? filePath
            : path.resolve(workingDirectory, filePath);
        // 2. Check if in a git repository
        const repoInfo = await this.findRepositoryRoot(absolutePath);
        if (repoInfo) {
            // File is in a repository
            const relativePath = path.relative(repoInfo.root, absolutePath);
            return {
                originalPath: filePath,
                context: this.classifyPathInRepo(relativePath),
                repository: {
                    gitRoot: repoInfo.root,
                    relativePath,
                    remoteUrl: repoInfo.remoteUrl,
                    owner: repoInfo.owner,
                    repo: repoInfo.repo,
                },
                absolutePath,
                displayPath: relativePath, // Display relative to git root
            };
        }
        // 3. File is not in a repository - classify as external
        const context = classifyPath(absolutePath);
        const systemInfo = this.getSystemInfo(absolutePath);
        return {
            originalPath: filePath,
            context,
            system: systemInfo,
            absolutePath,
            displayPath: this.formatDisplayPath(absolutePath, context),
        };
    }
    /**
     * Normalize multiple paths at once
     */
    async normalizePaths(paths, workingDirectory) {
        return Promise.all(paths.map(p => this.normalizePath(p, workingDirectory)));
    }
    /**
     * Classify a path within a repository
     */
    classifyPathInRepo(relativePath) {
        const normalizedPath = relativePath.replace(/\\/g, '/');
        // Check if it's a dependency/system file even within the repo
        if (normalizedPath.includes('node_modules/') ||
            normalizedPath.includes('vendor/') ||
            normalizedPath.includes('.pnpm/')) {
            return PathContext.SYSTEM_FILE;
        }
        // Check if it's a config file
        if (normalizedPath.includes('.env') ||
            normalizedPath.match(/\.(json|yaml|yml|toml|ini|conf)$/)) {
            return PathContext.CONFIG_FILE;
        }
        // Otherwise it's a regular repo file
        return PathContext.REPO_FILE;
    }
    /**
     * Get system information for a path
     */
    getSystemInfo(absolutePath) {
        const normalizedPath = absolutePath.replace(/\\/g, '/');
        const isHomeDir = absolutePath.startsWith(this.homeDir);
        const isSystemPath = normalizedPath.startsWith('/usr/') ||
            normalizedPath.startsWith('/lib/') ||
            normalizedPath.startsWith('/bin/') ||
            normalizedPath.startsWith('/sbin/') ||
            normalizedPath.startsWith('/etc/') ||
            normalizedPath.startsWith('/System/') || // macOS
            normalizedPath.startsWith('C:/Windows/') ||
            normalizedPath.startsWith('C:/Program Files/');
        const isTempPath = normalizedPath.includes('/tmp/') ||
            normalizedPath.includes('/var/folders/') ||
            normalizedPath.includes('/Temp/') ||
            normalizedPath.includes('/.cache/');
        let category;
        if (normalizedPath.includes('node_modules')) {
            category = 'node_modules';
        }
        else if (normalizedPath.includes('.env')) {
            category = 'environment';
        }
        else if (normalizedPath.includes('config')) {
            category = 'config';
        }
        else if (isTempPath) {
            category = 'temp';
        }
        else if (normalizedPath.includes('.cache')) {
            category = 'cache';
        }
        else if (normalizedPath.includes('log')) {
            category = 'logs';
        }
        return {
            isHomeDir,
            isSystemPath,
            isTempPath,
            category,
        };
    }
    /**
     * Format a path for display
     */
    formatDisplayPath(absolutePath, context) {
        // Replace home directory with ~
        if (absolutePath.startsWith(this.homeDir)) {
            return absolutePath.replace(this.homeDir, '~');
        }
        // Abbreviate temp paths
        if (context === PathContext.TEMP_FILE) {
            const filename = path.basename(absolutePath);
            return `[temp]/${filename}`;
        }
        // Abbreviate system paths
        if (context === PathContext.SYSTEM_FILE) {
            if (absolutePath.includes('node_modules')) {
                const parts = absolutePath.split('node_modules');
                return `[node_modules]${parts[parts.length - 1]}`;
            }
            if (absolutePath.includes('vendor')) {
                const parts = absolutePath.split('vendor');
                return `[vendor]${parts[parts.length - 1]}`;
            }
        }
        // For Windows paths, simplify the display
        if (absolutePath.match(/^[A-Z]:\\/)) {
            const driveLetter = absolutePath[0];
            const pathWithoutDrive = absolutePath.substring(3);
            if (context === PathContext.SYSTEM_FILE) {
                return `[${driveLetter}:]${pathWithoutDrive}`;
            }
        }
        return absolutePath;
    }
    /**
     * Check if a path should be tracked in detail
     * (Some paths like temp files might only need counts)
     */
    shouldTrackInDetail(pathInfo) {
        // Always track repository files in detail
        if (pathInfo.context === PathContext.REPO_FILE) {
            return true;
        }
        // Track config files in detail
        if (pathInfo.context === PathContext.CONFIG_FILE) {
            return true;
        }
        // Don't track temp files in detail
        if (pathInfo.context === PathContext.TEMP_FILE) {
            return false;
        }
        // Don't track system files in detail unless they're special
        if (pathInfo.context === PathContext.SYSTEM_FILE) {
            // Track package.json files even in node_modules
            if (pathInfo.originalPath.endsWith('package.json')) {
                return true;
            }
            return false;
        }
        // Track user files by default
        return true;
    }
}
