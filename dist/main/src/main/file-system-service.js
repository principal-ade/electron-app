import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
export class FileSystemService {
    static DEFAULT_EXCLUDE = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        'coverage',
        '.cache',
        '.turbo',
        '.vercel',
        '.netlify',
        'out',
        'tmp',
        'temp',
    ];
    static DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1MB
    static async getDirectoryTree(dirPath, options = {}) {
        const { maxDepth = 5, includeContent = false, exclude = this.DEFAULT_EXCLUDE, maxFileSize = this.DEFAULT_MAX_FILE_SIZE, } = options;
        return this.buildTree(dirPath, dirPath, 0, maxDepth, includeContent, exclude, maxFileSize);
    }
    static async buildTree(rootPath, currentPath, currentDepth, maxDepth, includeContent, exclude, maxFileSize) {
        const name = path.basename(currentPath);
        const stats = await stat(currentPath);
        if (stats.isFile()) {
            const node = {
                name,
                path: path.relative(rootPath, currentPath),
                type: 'file',
                size: stats.size,
            };
            // Include content if requested and file is not too large
            if (includeContent && stats.size <= maxFileSize) {
                try {
                    // Only read text files
                    const ext = path.extname(name).toLowerCase();
                    const textExtensions = [
                        '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
                        '.html', '.css', '.scss', '.yaml', '.yml', '.toml',
                        '.env', '.gitignore', '.prettierrc', '.eslintrc',
                        '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go',
                        '.rs', '.swift', '.kt', '.rb', '.php', '.sh', '.bash',
                    ];
                    if (textExtensions.includes(ext) || !ext) {
                        node.content = await readFile(currentPath, 'utf-8');
                    }
                }
                catch (error) {
                    console.error(`Failed to read file ${currentPath}:`, error);
                }
            }
            return node;
        }
        // Directory
        const node = {
            name,
            path: path.relative(rootPath, currentPath) || '.',
            type: 'directory',
            children: [],
        };
        // Check if we've reached max depth
        if (currentDepth >= maxDepth) {
            return node;
        }
        try {
            const items = await readdir(currentPath);
            for (const item of items) {
                // Skip excluded directories
                if (exclude.includes(item)) {
                    continue;
                }
                // Skip hidden files/folders (starting with .)
                if (item.startsWith('.') && item !== '.env' && item !== '.gitignore') {
                    continue;
                }
                const itemPath = path.join(currentPath, item);
                try {
                    const childNode = await this.buildTree(rootPath, itemPath, currentDepth + 1, maxDepth, includeContent, exclude, maxFileSize);
                    node.children.push(childNode);
                }
                catch (error) {
                    console.error(`Failed to process ${itemPath}:`, error);
                }
            }
            // Sort children: directories first, then files, alphabetically
            node.children.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
        }
        catch (error) {
            console.error(`Failed to read directory ${currentPath}:`, error);
        }
        return node;
    }
    static async loadAllTextFiles(dirPath, options = {}) {
        const fileContents = new Map();
        const tree = await this.getDirectoryTree(dirPath, {
            ...options,
            includeContent: true,
        });
        this.collectFileContents(tree, fileContents);
        return fileContents;
    }
    static collectFileContents(node, fileContents) {
        if (node.type === 'file' && node.content) {
            fileContents.set(node.path, node.content);
        }
        else if (node.type === 'directory' && node.children) {
            for (const child of node.children) {
                this.collectFileContents(child, fileContents);
            }
        }
    }
    static async getAvailableLocalClones() {
        // This would typically scan a known directory for git repositories
        // For now, return empty array - can be implemented later
        return [];
    }
}
