const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const normalizeSlashes = (p) => p.replace(/\\/g, '/').replace(/\/+/g, '/');
export function validateFileSystemTree(tree, options = {}) {
    const { requireRootName = true } = options;
    const issues = [];
    // Root checks
    const root = tree.root;
    if (!root) {
        issues.push({ code: 'root.missing', severity: 'error', message: 'Root directory is missing' });
    }
    else {
        if (requireRootName && !isNonEmptyString(root.name)) {
            issues.push({
                code: 'root.name.empty',
                severity: 'error',
                message: 'Root name must be a non-empty string',
            });
        }
        const rootName = root.name || 'root';
        const rootPath = root.path;
        const rootRel = root.relativePath;
        // For relative path trees, expect: path="." or "", name="root" or repo name, relativePath=""
        const isRelativePathTree = rootPath === '.' || rootPath === '' || rootPath === undefined;
        if (rootRel !== '' && rootRel !== undefined) {
            issues.push({
                code: 'root.relativePath.invalid',
                severity: 'warning',
                message: 'Root relativePath should be an empty string',
            });
        }
        if (!isRelativePathTree) {
            // Only check path matching for non-relative trees
            if (!isNonEmptyString(rootPath)) {
                issues.push({
                    code: 'root.path.missing',
                    severity: 'warning',
                    message: 'Root path is missing; expected to equal root name',
                });
            }
            else if (rootPath !== rootName) {
                issues.push({
                    code: 'root.path.mismatch',
                    severity: 'warning',
                    message: `Root path should equal root name (${rootName})`,
                    path: rootPath,
                });
            }
        }
    }
    // File checks
    const seenFilePaths = new Set();
    const extensions = new Set();
    for (const f of tree.allFiles || []) {
        const fi = f;
        if (!isNonEmptyString(fi.name)) {
            issues.push({
                code: 'file.name.empty',
                severity: 'error',
                message: 'File name missing',
                path: fi.path,
            });
        }
        if (!isNonEmptyString(fi.relativePath)) {
            issues.push({
                code: 'file.relativePath.missing',
                severity: 'error',
                message: 'File relativePath missing',
                path: fi.path,
            });
        }
        else {
            const rel = normalizeSlashes(fi.relativePath);
            if (rel.startsWith('/')) {
                issues.push({
                    code: 'file.relativePath.leadingSlash',
                    severity: 'error',
                    message: 'File relativePath should not start with /',
                    path: rel,
                });
            }
            // Check for parent directory reference (..) but not Next.js catch-all routes ([...])
            if (rel.includes('../') ||
                rel.includes('/..') ||
                (rel.includes('..') && !rel.includes('[...'))) {
                issues.push({
                    code: 'file.relativePath.dotdot',
                    severity: 'warning',
                    message: 'File relativePath should not contain parent directory reference (..)',
                    path: rel,
                });
            }
        }
        if (!isNonEmptyString(fi.path)) {
            issues.push({ code: 'file.path.missing', severity: 'error', message: 'File path missing' });
        }
        else {
            const full = normalizeSlashes(fi.path);
            if (seenFilePaths.has(full)) {
                issues.push({
                    code: 'file.path.duplicate',
                    severity: 'error',
                    message: 'Duplicate file path',
                    path: full,
                });
            }
            seenFilePaths.add(full);
            if (full.startsWith('/')) {
                issues.push({
                    code: 'file.path.leadingSlash',
                    severity: 'error',
                    message: 'File path should not start with /',
                    path: full,
                });
            }
            if (full.endsWith('/')) {
                issues.push({
                    code: 'file.path.trailingSlash',
                    severity: 'warning',
                    message: 'File path should not end with /',
                    path: full,
                });
            }
            // Only check root prefixing for non-relative path trees
            const rootPath = root?.path;
            const isRelativePathTree = rootPath === '.' || rootPath === '' || rootPath === undefined;
            if (!isRelativePathTree) {
                const rootName = root?.name;
                if (isNonEmptyString(rootName) && rootName !== 'root') {
                    const expectedPrefix = `${rootName}/`;
                    if (!full.startsWith(expectedPrefix)) {
                        issues.push({
                            code: 'file.path.notRootPrefixed',
                            severity: 'warning',
                            message: `File path should start with ${expectedPrefix}`,
                            path: full,
                        });
                    }
                }
            }
        }
        if (fi.isDirectory === true) {
            issues.push({
                code: 'file.isDirectory.true',
                severity: 'error',
                message: 'File marked as directory',
                path: fi.path,
            });
        }
        if (fi.extension)
            extensions.add(fi.extension);
    }
    // Directory checks
    const seenDirPaths = new Set();
    for (const d of tree.allDirectories || []) {
        const di = d;
        if (!isNonEmptyString(di.name)) {
            issues.push({
                code: 'dir.name.empty',
                severity: 'error',
                message: 'Directory name missing',
                path: di.path,
            });
        }
        if (!Array.isArray(di.children)) {
            issues.push({
                code: 'dir.children.missing',
                severity: 'error',
                message: 'Directory children missing',
                path: di.path,
            });
        }
        if (!isNonEmptyString(di.path)) {
            issues.push({
                code: 'dir.path.missing',
                severity: 'error',
                message: 'Directory path missing',
            });
        }
        else {
            const full = normalizeSlashes(di.path);
            if (seenDirPaths.has(full)) {
                issues.push({
                    code: 'dir.path.duplicate',
                    severity: 'warning',
                    message: 'Duplicate directory path',
                    path: full,
                });
            }
            seenDirPaths.add(full);
            // Allow empty string for root, but not leading slash for others
            if (full !== '' && full !== '.' && full.startsWith('/')) {
                issues.push({
                    code: 'dir.path.leadingSlash',
                    severity: 'error',
                    message: 'Directory path should not start with /',
                    path: full,
                });
            }
            if (full.endsWith('/')) {
                issues.push({
                    code: 'dir.path.trailingSlash',
                    severity: 'warning',
                    message: 'Directory path should not end with /',
                    path: full,
                });
            }
        }
    }
    // Cross checks: every file's parent directory should exist
    const rootPath = root?.path;
    const isRelativePathTree = rootPath === '.' || rootPath === '' || rootPath === undefined;
    for (const fp of seenFilePaths) {
        const parent = fp.split('/').slice(0, -1).join('/');
        // For files in root directory of relative path trees
        if (parent === '' && isRelativePathTree) {
            // Check if root directory is in the list (could be '', '.', or the root name)
            const hasRootDir = seenDirPaths.has('') || seenDirPaths.has('.') || seenDirPaths.has(root?.name);
            if (!hasRootDir) {
                // This is expected for relative path trees - root files have no parent directory entry
                continue;
            }
        }
        else if (parent) {
            // For files in subdirectories
            if (!seenDirPaths.has(parent)) {
                issues.push({
                    code: 'dir.missing.parentForFile',
                    severity: 'warning',
                    message: 'Missing parent directory for file',
                    path: fp,
                    details: { parent },
                });
            }
        }
    }
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const autoFixSuggestions = [];
    if (issues.find(i => i.code === 'root.name.empty'))
        autoFixSuggestions.push('Provide a non-empty root.name (e.g., "root").');
    if (issues.find(i => i.code === 'file.relativePath.leadingSlash'))
        autoFixSuggestions.push('Strip leading / from file.relativePath values.');
    if (issues.find(i => i.code === 'file.path.notRootPrefixed'))
        autoFixSuggestions.push('Prefix file.path with root.name + "/" + relativePath.');
    if (issues.find(i => i.code === 'file.isDirectory.true'))
        autoFixSuggestions.push('Ensure files have isDirectory=false.');
    if (issues.find(i => i.code === 'dir.children.missing'))
        autoFixSuggestions.push('Ensure each directory lists its children array.');
    return {
        ok: errorCount === 0,
        errorCount,
        warningCount,
        issues,
        summary: {
            totalFiles: tree.allFiles?.length || 0,
            totalDirectories: tree.allDirectories?.length || 0,
            distinctExtensions: extensions.size,
        },
        autoFixSuggestions,
    };
}
//# sourceMappingURL=FileSystemTreeValidator.js.map