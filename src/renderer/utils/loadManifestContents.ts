import {
  PackageLayerModule,
  FileSystemTree,
} from '@principal-ai/codebase-composition';

/**
 * Options for loading manifest contents
 */
interface LoadManifestOptions {
  fileSystemTree: FileSystemTree;
  fileSystemAdapter: any; // FileSystem adapter (GitHub or Electron)
  packageModule?: PackageLayerModule; // Optional: provide existing module to reuse
  rootPath?: string; // Optional: absolute repo root for local sources
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
export async function loadManifestContents(
  options: LoadManifestOptions,
): Promise<Map<string, any>> {
  const { fileSystemTree, fileSystemAdapter, packageModule, rootPath } =
    options;

  // Create or use provided package module to access its parsers
  const pkgModule = packageModule || new PackageLayerModule();
  const manifestContents = new Map<string, any>();

  if (!fileSystemTree.allFiles || fileSystemTree.allFiles.length === 0) {
    console.warn(
      '[loadManifestContents] No allFiles present on fileSystemTree',
    );
    return manifestContents;
  }

  // Known fallback patterns for manifests if parser list is unavailable
  const fallbackPatterns = [
    'package.json',
    'pyproject.toml',
    'Cargo.toml',
    'pom.xml',
    'go.mod',
    'requirements.txt',
    'Gemfile',
    'composer.json',
  ];

  // Helper to normalize entries to a path string
  const toPath = (entry: any): string => {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry.path === 'string') return entry.path;
    if (entry && typeof entry.name === 'string') return entry.name as string;
    return '';
  };

  // Find all manifest files using PackageLayerModule's parsers (if available), else fallback patterns
  const parsers: any[] = (pkgModule as any).parsers || [];
  const hasParsers = Array.isArray(parsers) && parsers.length > 0;

  const manifestFiles = fileSystemTree.allFiles
    .map((f: any) => toPath(f))
    .filter((p: string) => !!p)
    .filter((p: string) => {
      if (hasParsers) {
        try {
          return parsers.some((parser: any) => parser?.canParse?.(p));
        } catch {
          // If parser check fails, fall back to pattern check below
        }
      }
      // Fallback pattern check
      const base = p.split('/').pop() || p;
      return fallbackPatterns.includes(base);
    });

  console.log('[loadManifestContents] Found manifest files:', manifestFiles);

  // Load contents of each manifest file
  for (const path of manifestFiles) {
    try {
      const resolvedPath = (() => {
        if (rootPath && !path.startsWith('/')) {
          // Join rootPath and relative repo path for local sources
          const base = rootPath.replace(/\/$/, '');
          const rel = path.replace(/^\/+/, '');
          const joined = `${base}/${rel}`;
          return joined;
        }
        return path;
      })();

      if (rootPath) {
        console.debug('[loadManifestContents] reading', { path, resolvedPath });
      }

      const result = await fileSystemAdapter.readFile(resolvedPath);

      if (result && result.content) {
        // Parse based on file type
        const parsed = parseManifestContent(path, result.content);
        manifestContents.set(path, parsed);
      } else {
        // Create fallback manifest data
        console.warn(
          `[loadManifestContents] No content for ${path}, creating fallback`,
        );
        const fallback = createFallbackManifest(path);
        if (fallback !== null && fallback !== undefined) {
          manifestContents.set(path, fallback);
        }
      }
    } catch (err) {
      console.error(`[loadManifestContents] Failed to read ${path}:`, err);

      // Try to create a fallback even on error
      const fallback = createFallbackManifest(path);
      if (fallback !== null && fallback !== undefined) {
        manifestContents.set(path, fallback);
      }
    }
  }

  console.log(
    '[loadManifestContents] Loaded manifest contents for',
    manifestContents.size,
    'files',
  );
  return manifestContents;
}


/**
 * Parse manifest content based on file type
 */
function parseManifestContent(filePath: string, content: string): any {
  // JSON files (package.json, composer.json, etc.)
  if (filePath.endsWith('.json')) {
    try {
      return JSON.parse(content);
    } catch (parseErr) {
      console.warn(
        `[loadManifestContents] Failed to parse JSON for ${filePath}:`,
        parseErr,
      );
      return content; // Return raw content as fallback
    }
  }

  // TOML files (Cargo.toml, pyproject.toml)
  if (filePath.endsWith('.toml')) {
    // TODO: Add proper TOML parser when available
    console.log(
      `[loadManifestContents] TOML parsing not implemented for ${filePath}`,
    );

    // Try to extract basic info with simple regex
    const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
    const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);

    if (filePath.endsWith('Cargo.toml')) {
      return {
        package: {
          name: nameMatch?.[1] || 'unknown',
          version: versionMatch?.[1] || '0.0.0',
        },
      };
    } else if (filePath.endsWith('pyproject.toml')) {
      return {
        project: {
          name: nameMatch?.[1] || 'unknown',
          version: versionMatch?.[1] || '0.0.0',
        },
      };
    }

    return {};
  }

  // XML files (pom.xml)
  if (filePath.endsWith('.xml')) {
    // TODO: Add XML parser when needed
    console.log(
      `[loadManifestContents] XML parsing not implemented for ${filePath}`,
    );
    return content;
  }

  // Default: return raw content
  return content;
}

/**
 * Create fallback manifest data when file can't be read
 */
function createFallbackManifest(filePath: string): any {
  const dirName = filePath.split('/').slice(-2, -1)[0] || 'unnamed';

  if (filePath.endsWith('package.json')) {
    return {
      name: dirName,
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
    };
  }

  if (filePath.endsWith('pyproject.toml')) {
    return {
      project: {
        name: dirName,
        version: '0.0.0',
      },
    };
  }

  if (filePath.endsWith('Cargo.toml')) {
    return {
      package: {
        name: dirName,
        version: '0.0.0',
      },
    };
  }

  if (filePath.endsWith('go.mod')) {
    return {
      module: dirName,
      go: '1.19',
    };
  }

  if (filePath.endsWith('requirements.txt')) {
    return ''; // Empty requirements file
  }

  if (filePath.endsWith('Gemfile')) {
    return 'source "https://rubygems.org"';
  }

  if (filePath.endsWith('composer.json')) {
    return {
      name: `vendor/${dirName}`,
      version: '0.0.0',
      require: {},
    };
  }

  return null;
}
