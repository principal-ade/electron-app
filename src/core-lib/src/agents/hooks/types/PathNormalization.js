/**
 * Classification of file paths based on their context
 */
export var PathContext;
(function (PathContext) {
    PathContext["REPO_FILE"] = "repo_file";
    PathContext["SYSTEM_FILE"] = "system_file";
    PathContext["USER_FILE"] = "user_file";
    PathContext["TEMP_FILE"] = "temp_file";
    PathContext["CONFIG_FILE"] = "config_file";
})(PathContext || (PathContext = {}));
/**
 * File operation types for tracking
 */
export var FileOperation;
(function (FileOperation) {
    FileOperation["READ"] = "read";
    FileOperation["WRITE"] = "write";
    FileOperation["CREATE"] = "create";
    FileOperation["DELETE"] = "delete";
    FileOperation["EDIT"] = "edit";
    FileOperation["SEARCH"] = "search";
    FileOperation["LIST"] = "list";
})(FileOperation || (FileOperation = {}));
/**
 * Helper to determine file operation from tool name
 */
export function getFileOperation(toolName) {
    const toolNameLower = toolName.toLowerCase();
    if (toolNameLower.includes('read'))
        return FileOperation.READ;
    if (toolNameLower.includes('write'))
        return FileOperation.WRITE;
    if (toolNameLower.includes('create'))
        return FileOperation.CREATE;
    if (toolNameLower.includes('delete') || toolNameLower.includes('remove'))
        return FileOperation.DELETE;
    if (toolNameLower.includes('edit') || toolNameLower.includes('replace'))
        return FileOperation.EDIT;
    if (toolNameLower.includes('grep') || toolNameLower.includes('search'))
        return FileOperation.SEARCH;
    if (toolNameLower.includes('ls') || toolNameLower.includes('list'))
        return FileOperation.LIST;
    return undefined;
}
/**
 * Extract file paths from tool input based on tool name
 */
export function extractFilePathsFromToolInput(toolName, toolInput) {
    if (!toolInput || typeof toolInput !== 'object') {
        return [];
    }
    const paths = [];
    // Handle different tool naming conventions
    switch (toolName) {
        case 'Read':
        case 'Write':
        case 'Edit':
            if (toolInput.file_path)
                paths.push(toolInput.file_path);
            break;
        case 'MultiEdit':
            if (toolInput.file_path)
                paths.push(toolInput.file_path);
            // MultiEdit operates on a single file with multiple edits
            break;
        case 'NotebookRead':
        case 'NotebookEdit':
            if (toolInput.notebook_path)
                paths.push(toolInput.notebook_path);
            break;
        case 'Grep':
        case 'LS':
        case 'Glob':
            if (toolInput.path)
                paths.push(toolInput.path);
            // Note: Results come from toolOutput, not toolInput
            break;
        // Gemini tools
        case 'read_file': {
            const readPath = toolInput.absolute_path || toolInput.file_path;
            if (readPath)
                paths.push(readPath);
            break;
        }
        case 'write_file':
        case 'replace':
            if (toolInput.file_path)
                paths.push(toolInput.file_path);
            break;
        case 'read_many_files':
            if (toolInput.paths && Array.isArray(toolInput.paths)) {
                paths.push(...toolInput.paths);
            }
            break;
        // MCP tools
        default:
            if (toolName.startsWith('mcp_')) {
                // MCP tools use various field names
                const mcpPath = toolInput.filePath || toolInput.file_path || toolInput.path;
                if (mcpPath)
                    paths.push(mcpPath);
            }
            else {
                // Generic fallback - check common field names
                const genericPath = toolInput.file_path ||
                    toolInput.filePath ||
                    toolInput.path ||
                    toolInput.fileName ||
                    toolInput.absolute_path;
                if (genericPath)
                    paths.push(genericPath);
            }
    }
    return paths;
}
/**
 * Check if a path is absolute
 */
export function isAbsolutePath(filePath) {
    // Unix/Mac absolute paths
    if (filePath.startsWith('/'))
        return true;
    // Windows absolute paths
    if (/^[A-Za-z]:[\\/]/.test(filePath))
        return true;
    return false;
}
/**
 * Classify a file path based on patterns
 */
export function classifyPath(absolutePath) {
    // Normalize path separators for consistent checking
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    // Check for temp files first (highest priority)
    if (normalizedPath.includes('/tmp/') ||
        normalizedPath.includes('/var/folders/') ||
        normalizedPath.includes('/Temp/') ||
        normalizedPath.includes('/temp/') ||
        normalizedPath.includes('/.cache/')) {
        return PathContext.TEMP_FILE;
    }
    // Check for system/dependency files
    if (normalizedPath.includes('/node_modules/') ||
        normalizedPath.includes('/vendor/') ||
        normalizedPath.includes('/bower_components/') ||
        normalizedPath.includes('/.pnpm/') ||
        normalizedPath.includes('/site-packages/') ||
        normalizedPath.includes('/dist-packages/')) {
        return PathContext.SYSTEM_FILE;
    }
    // Check for config files
    if (normalizedPath.includes('/.env') ||
        normalizedPath.includes('/config') ||
        normalizedPath.includes('/.npmrc') ||
        normalizedPath.includes('/.gitconfig') ||
        normalizedPath.includes('/.ssh/') ||
        normalizedPath.match(/\.(json|yaml|yml|toml|ini|conf|cfg)$/)) {
        return PathContext.CONFIG_FILE;
    }
    // Check for system paths
    if (normalizedPath.startsWith('/usr/') ||
        normalizedPath.startsWith('/lib/') ||
        normalizedPath.startsWith('/bin/') ||
        normalizedPath.startsWith('/sbin/') ||
        normalizedPath.startsWith('/etc/') ||
        normalizedPath.startsWith('/System/') || // macOS
        normalizedPath.startsWith('C:/Windows/') ||
        normalizedPath.startsWith('C:/Program Files/')) {
        return PathContext.SYSTEM_FILE;
    }
    // Default to user file
    return PathContext.USER_FILE;
}
