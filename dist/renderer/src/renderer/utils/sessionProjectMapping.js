/**
 * Maps file operations from a session to architecture projects/packages
 * @param fileOperations - Map of file operations from AgentSessionService.extractFileOperations
 * @param packageLayers - Package layers from architecture analysis
 * @param repositoryPath - Repository root path for normalization (optional)
 * @returns Array of projects touched by the session
 */
export function mapFileOperationsToProjects(fileOperations, packageLayers, repositoryPath) {
    if (!packageLayers || packageLayers.length === 0) {
        return [];
    }
    const touchedProjects = new Map();
    // Process each file operation
    for (const [filePath, fileOp] of fileOperations) {
        // Get the normalized path for matching (prefer relativePath)
        let normalizedPath = fileOp.relativePath || fileOp.path;
        // Strip repository path if file path is absolute and contains repo path
        if (repositoryPath && normalizedPath.startsWith('/') && normalizedPath.startsWith(repositoryPath)) {
            normalizedPath = normalizedPath.substring(repositoryPath.length);
            if (normalizedPath.startsWith('/')) {
                normalizedPath = normalizedPath.substring(1);
            }
        }
        // Ensure no leading slash for consistent matching
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }
        // Find which package this file belongs to
        const matchingPackage = findPackageForFile(normalizedPath, packageLayers);
        if (matchingPackage) {
            const packagePath = normalizePackagePath(matchingPackage.packageData.path);
            if (!touchedProjects.has(packagePath)) {
                touchedProjects.set(packagePath, {
                    name: matchingPackage.packageData.name,
                    path: packagePath,
                    packageManager: matchingPackage.packageData.packageManager,
                    touchedFiles: [],
                    operationTypes: new Set(),
                    fileCount: 0,
                    hasWrites: false,
                    // Include first 5 available commands from the package
                    availableCommands: matchingPackage.packageData.availableCommands?.slice(0, 5)
                });
            }
            const project = touchedProjects.get(packagePath);
            project.touchedFiles.push(normalizedPath);
            project.fileCount++;
            // Track operation types
            for (const op of fileOp.operations) {
                project.operationTypes.add(op.type);
                if (op.type === 'write' || op.type === 'edit') {
                    project.hasWrites = true;
                }
            }
        }
    }
    return Array.from(touchedProjects.values());
}
/**
 * Finds the package that contains a given file path
 * @param filePath - Normalized file path (relative to repo root)
 * @param packageLayers - Array of package layers
 * @returns Matching package or null
 */
function findPackageForFile(filePath, packageLayers) {
    // Sort packages by path depth (deepest first) for most specific match
    const sortedPackages = [...packageLayers].sort((a, b) => {
        const aDepth = a.packageData.path.split('/').length;
        const bDepth = b.packageData.path.split('/').length;
        return bDepth - aDepth; // Descending order (deepest first)
    });
    for (const pkg of sortedPackages) {
        const packagePath = normalizePackagePath(pkg.packageData.path);
        // Check if file is within this package directory
        if (isFileInPackage(filePath, packagePath)) {
            return pkg;
        }
    }
    return null;
}
/**
 * Normalizes a package path for consistent matching
 * @param packagePath - Package path from packageData
 * @returns Normalized path
 */
function normalizePackagePath(packagePath) {
    // Remove leading slash and ensure no trailing slash
    let normalized = packagePath.startsWith('/') ? packagePath.substring(1) : packagePath;
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}
/**
 * Checks if a file is within a package directory
 * @param filePath - Normalized file path
 * @param packagePath - Normalized package path
 * @returns True if file is in package
 */
function isFileInPackage(filePath, packagePath) {
    // Root package (empty path) contains all files
    if (packagePath === '' || packagePath === '.') {
        return true;
    }
    // File is exactly the package directory
    if (filePath === packagePath) {
        return true;
    }
    // File is within package directory
    if (filePath.startsWith(packagePath + '/')) {
        return true;
    }
    // Check for package manifest files in this directory
    const packageManifests = [
        'package.json',
        'Cargo.toml',
        'go.mod',
        'setup.py',
        'pyproject.toml'
    ];
    for (const manifest of packageManifests) {
        if (filePath === packagePath + '/' + manifest || filePath === manifest) {
            return true;
        }
    }
    return false;
}
/**
 * Gets a summary of touched projects for display
 * @param touchedProjects - Array of touched projects
 * @returns Summary object for UI display
 */
export function getTouchedProjectsSummary(touchedProjects) {
    const totalProjects = touchedProjects.length;
    const totalFiles = touchedProjects.reduce((sum, proj) => sum + proj.fileCount, 0);
    const projectsWithWrites = touchedProjects.filter(proj => proj.hasWrites).length;
    const projectsReadOnly = totalProjects - projectsWithWrites;
    return {
        totalProjects,
        totalFiles,
        projectsWithWrites,
        projectsReadOnly,
        hasActivity: totalProjects > 0
    };
}
