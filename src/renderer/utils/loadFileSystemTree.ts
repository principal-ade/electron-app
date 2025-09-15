import { FileSystemModule, FilesystemService } from "@principal-ai/codebase-composition";
import type { FileTree, FileInfo, DirectoryInfo } from "@principal-ai/repository-abstraction";
import type { FileSystemFilterLayer } from "@principal-ai/codebase-composition";
import { GitHubWebAdapters } from '../adapters/GitHubWebAdapters';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GitService } from '../main-process-api/GitService';
import * as path from 'path';

export interface TreeLoadResult {
  fileTree: FileTree;
  stats: {
    fileCount: number;
    directoryCount: number;
  };
  filterLayers?: any[]; // Filter layers that were applied
}

// Strongly-typed options for local tree loading
export interface LocalTreeOptions {
  localPath: string;
  owner: string;  // Used for config/metadata
  repo: string;   // Used for config/metadata
}

// Strongly-typed options for GitHub tree loading
export interface GitHubTreeOptions {
  owner: string;
  repo: string;
  branch: string;
}

// Legacy interface for backwards compatibility
export interface TreeLoadOptions {
  type: 'local' | 'github';
  localPath?: string;  // For local
  owner?: string;       // For GitHub (also used for local config)
  repo?: string;        // For GitHub (also used for local config)
  branch?: string;      // For GitHub
}

/**
 * Transform a simple paths array from buildFilteredFileTree into a rich FileTree structure
 */
async function transformPathsToFileTree(
  rootPath: string, 
  paths: string[], 
  filters?: FileSystemFilterLayer[]
): Promise<FileTree> {
  const allFiles: FileInfo[] = [];
  const allDirectories: DirectoryInfo[] = [];
  let totalSize = 0;
  let maxDepth = 0;
  const typeDistribution: Record<string, number> = {};

  // Separate files and directories
  const filePaths = paths.filter(p => !p.endsWith('/'));
  const dirPaths = paths.filter(p => p.endsWith('/'));

  // Process files
  for (const relativePath of filePaths) {
    const fullPath = path.join(rootPath, relativePath);
    
    // Get file stats via FileSystem API
    const stats = await FileSystemService.getFileStats(fullPath);
    if (!stats) continue;

    const extension = path.extname(relativePath).toLowerCase() || 'no-extension';
    const depth = relativePath.split('/').length - 1;
    maxDepth = Math.max(maxDepth, depth);

    // Count by extension
    typeDistribution[extension] = (typeDistribution[extension] || 0) + 1;
    totalSize += stats.size;

    allFiles.push({
      path: fullPath,
      name: path.basename(relativePath),
      extension,
      size: stats.size,
      lastModified: new Date(stats.lastModified),
      isDirectory: false,
      relativePath
    });
  }

  // Process directories 
  for (const relativePath of dirPaths) {
    const cleanPath = relativePath.endsWith('/') ? relativePath.slice(0, -1) : relativePath;
    const fullPath = path.join(rootPath, cleanPath);
    const depth = cleanPath.split('/').length - (cleanPath === '' ? 1 : 0);
    maxDepth = Math.max(maxDepth, depth);

    // Count files in this directory
    const filesInDir = allFiles.filter(f => 
      path.dirname(f.relativePath) === cleanPath || 
      (cleanPath === '' && !f.relativePath.includes('/'))
    );

    allDirectories.push({
      path: fullPath,
      name: path.basename(cleanPath) || path.basename(rootPath),
      children: [], // We'll build the tree structure later if needed
      fileCount: filesInDir.length,
      totalSize: filesInDir.reduce((sum, f) => sum + f.size, 0),
      depth,
      relativePath: cleanPath
    });
  }

  // Create root directory
  const rootDir: DirectoryInfo = {
    path: rootPath,
    name: path.basename(rootPath),
    children: [],
    fileCount: allFiles.length,
    totalSize,
    depth: 0,
    relativePath: ''
  };

  return {
    sha: 'generated-' + Date.now(), // Simple SHA for now
    root: rootDir,
    allFiles,
    allDirectories,
    stats: {
      totalFiles: allFiles.length,
      totalDirectories: allDirectories.length,
      totalSize,
      maxDepth,
      buildingTypeDistribution: typeDistribution,
      directoryTypeDistribution: {}, // Could implement if needed
      combinedTypeDistribution: typeDistribution
    }
  };
}

/**
 * Load a filesystem tree from local filesystem
 */
export async function loadLocalFileSystemTree(options: LocalTreeOptions): Promise<TreeLoadResult> {
  console.log(`🔧 [loadLocalFileSystemTree] Starting LOCAL file tree load:`, {
    localPath: options.localPath,
    owner: options.owner,
    repo: options.repo
  });
  
  // Check for .gitignore file - it's required for proper filtering
  const gitignorePath = path.join(options.localPath, '.gitignore');
  const gitignoreExists = await FileSystemService.getFileStats(gitignorePath) !== null;
  
  if (!gitignoreExists) {
    console.error(`❌ [loadLocalFileSystemTree] No .gitignore found at ${gitignorePath}`);
    throw new Error(`Repository must have a .gitignore file for proper filtering.\nPlease create one at: ${gitignorePath}\n\nExample content:\nnode_modules/\ndist/\n.DS_Store\n*.log`);
  }
  
  console.log(`✅ [loadLocalFileSystemTree] Found .gitignore at ${gitignorePath}`);
  
  // Note: VCS detection is disabled since globby now handles .gitignore filtering automatically.
  // This avoids redundant .gitignore parsing and expensive IPC calls.
  
  // Create filesystem module using core implementation
  const fileSystemModule = new FileSystemModule({
    directoryPath: options.localPath,
    buildFileSystemTree: async (path, filters) => {
      // Use our optimized buildFilteredFileTree with automatic .gitignore support
      // Globby handles .gitignore parsing and we add common patterns like node_modules, dist, etc.
      const { paths } = await FileSystemService.buildFilteredFileTree(path, {
        gitignore: true,  // Enable .gitignore support (default)
        includeStats: false  // Don't include stats during initial load for performance
      });
      
      // Transform the simple paths array into the rich FileTree structure
      const fileTree: FileTree = await transformPathsToFileTree(path, paths, filters);
      
      return fileTree;
    },
    // No configLoader - we don't use scan filters anymore, globby handles everything
    // No versionControlLayerFactory - globby handles .gitignore automatically
  });
  
  console.log(`📊 [loadLocalFileSystemTree] Loading filesystem tree via FileSystemModule...`);
  
  // Load the filesystem tree
  const result = await fileSystemModule.loadFileSystemTree();
  const tree = result.fileSystemTree;
  
  console.log('✅ [loadLocalFileSystemTree] FileSystemModule result:', {
    hasTree: !!result.fileSystemTree,
    hasFilterLayers: !!result.filterLayers,
    filterLayersCount: result.filterLayers?.length || 0,
    filterLayers: result.filterLayers,
    hasAppliedFilters: !!(result.fileSystemTree as any)?.appliedFilters,
    appliedFiltersCount: ((result.fileSystemTree as any)?.appliedFilters || []).length,
    appliedFilters: (result.fileSystemTree as any)?.appliedFilters
  });
  
  if (!tree) {
    console.error(`❌ [loadLocalFileSystemTree] Failed to load filesystem tree from ${options.localPath}`);
    throw new Error(`Failed to load filesystem tree from ${options.localPath}`);
  }
  
  // Calculate statistics
  const stats = {
    fileCount: tree.allFiles?.length || 0,
    directoryCount: tree.allDirectories?.length || 0
  };
  
  console.log(`🎯 [loadLocalFileSystemTree] LOCAL tree loaded successfully:`, {
    path: options.localPath,
    fileCount: stats.fileCount,
    directoryCount: stats.directoryCount,
    pathsCount: tree.paths?.length || 0,
    hasAllFiles: !!tree.allFiles,
    hasAllDirectories: !!tree.allDirectories
  });
  
  return {
    fileTree: tree,
    stats,
    filterLayers: result.filterLayers
  };
}

/**
 * Load a filesystem tree from GitHub API
 */
export async function loadGitHubFileSystemTree(options: GitHubTreeOptions): Promise<TreeLoadResult> {
  console.log(`🌐 [loadGitHubFileSystemTree] Starting REMOTE file tree load:`, {
    owner: options.owner,
    repo: options.repo,
    branch: options.branch
  });
  
  const adapters = new GitHubWebAdapters(options.owner, options.repo, options.branch);
  
  const githubSource = { type: 'github' as const, owner: options.owner, repo: options.repo, branch: options.branch };
  
  // Create filesystem module (no VCS or config for GitHub)
  const fileSystemModule = new FileSystemModule({
    directoryPath: '/',
    buildFileSystemTree: async (path, filters) => {
      // Use core's FilesystemService directly
      const fs = new FilesystemService(adapters.fileSystem);
      return await fs.buildFileSystemTreeFromPath('', filters || [], { 
        generateWarningsForMandatoryFilters: true 
      });
    },
    // No configLoader or versionControlLayerFactory for GitHub
    // GitHub API already returns filtered results
  });
  
  // Load the filesystem tree
  const result = await fileSystemModule.loadFileSystemTree();
  const tree = result.fileSystemTree;
  
  if (!tree) {
    throw new Error(`Failed to load filesystem tree from ${options.owner}/${options.repo}`);
  }
  
  // Calculate statistics
  const stats = {
    fileCount: tree.allFiles?.length || 0,
    directoryCount: tree.allDirectories?.length || 0
  };
  
  return {
    fileTree: tree,
    stats
  };
}

// Strongly-typed options for local git commit loading
export interface LocalGitCommitOptions {
  localPath: string;
  owner: string;
  repo: string;
  commitSha: string;
}

/**
 * Load a filesystem tree from a specific git commit in a local repository
 * Uses git ls-tree command to get file structure from the commit
 */
export async function loadLocalGitCommitTree(options: LocalGitCommitOptions): Promise<TreeLoadResult> {
  const { localPath, owner, repo, commitSha } = options;
  
  try {
    console.log(`[loadLocalGitCommitTree] Executing git ls-tree in ${localPath} for commit ${commitSha}`);
    
    // Execute git ls-tree to get file structure from the specific commit
    const result = await GitService.execCommand(
      localPath,
      ['ls-tree', '-r', '--name-only', commitSha]
    );
    
    console.log(`[loadLocalGitCommitTree] Git command result:`, {
      success: result.success,
      stdout: result.stdout?.substring(0, 200) + (result.stdout?.length > 200 ? '...' : ''),
      stderr: result.stderr,
      code: (result as any).code
    });
    
    // Check if the command succeeded (success might be undefined, so check for stdout and no stderr)
    if (!result.stdout || (result.stderr && result.stderr.trim().length > 0)) {
      throw new Error(`Git ls-tree failed: ${result.stderr || 'No output'}`);
    }
    
    // Parse file paths from git ls-tree output
    const filePaths = result.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (filePaths.length === 0) {
      throw new Error('No files found in commit');
    }
    
    // Build a simple file tree structure
    // For now, we'll create a minimal tree that satisfies the FileTree interface
    const allFiles = filePaths.map(path => ({
      path,
      name: path.split('/').pop() || path,
      isDirectory: false,
      extension: path.includes('.') ? path.split('.').pop() || '' : '',
      size: 0, // Size not available from ls-tree --name-only
      lastModified: new Date().toISOString() // Not available, use current time
    }));
    
    // Create directory entries from file paths
    const dirSet = new Set<string>();
    filePaths.forEach(filePath => {
      const parts = filePath.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
        const dirPath = parts.slice(0, i + 1).join('/');
        dirSet.add(dirPath);
      }
    });
    
    const allDirectories = Array.from(dirSet).map(path => ({
      path,
      name: path.split('/').pop() || path,
      isDirectory: true,
      children: [], // We'll populate this if needed
      size: 0,
      lastModified: new Date().toISOString()
    }));
    
    // Create the file tree object
    const fileTree = {
      name: repo,
      path: '',
      isDirectory: true,
      children: [], // We could build the tree structure here if needed
      allFiles,
      allDirectories,
      // Add other required properties for FileTree interface
      size: allFiles.reduce((sum, file) => sum + (file.size || 0), 0),
      lastModified: new Date().toISOString()
    };
    
    const stats = {
      fileCount: allFiles.length,
      directoryCount: allDirectories.length
    };
    
    console.log(`[loadLocalGitCommitTree] Loaded ${stats.fileCount} files, ${stats.directoryCount} directories from commit ${commitSha.substring(0, 7)}`);
    
    return {
      fileTree,
      stats
    };
    
  } catch (error) {
    console.error(`[loadLocalGitCommitTree] Failed to load commit ${commitSha}:`, error);
    throw error;
  }
}

/**
 * Load a filesystem tree from either local filesystem or GitHub API
 * @deprecated Use loadLocalFileSystemTree or loadGitHubFileSystemTree for better type safety
 */
export async function loadFileSystemTree(options: TreeLoadOptions): Promise<TreeLoadResult> {
  // Delegate to the appropriate strongly-typed function
  if (options.type === 'local') {
    if (!options.localPath || !options.owner || !options.repo) {
      throw new Error('localPath, owner, and repo are required for local tree loading');
    }
    return loadLocalFileSystemTree({
      localPath: options.localPath,
      owner: options.owner,
      repo: options.repo
    });
  } else {
    if (!options.owner || !options.repo || !options.branch) {
      throw new Error('owner, repo, and branch are required for GitHub tree loading');
    }
    return loadGitHubFileSystemTree({
      owner: options.owner,
      repo: options.repo,
      branch: options.branch
    });
  }
}
