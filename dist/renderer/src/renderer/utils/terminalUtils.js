/**
 * Utility functions for terminal operations
 *
 * Now uses the unified ShellAPI instead of direct IPC calls.
 */
import { ShellService } from '../main-process-api/ShellService';
/**
 * Check if a command is available in the user's PATH
 */
export async function checkCommandAvailability(command) {
    try {
        const result = await ShellService.checkCommand(command);
        return {
            available: result.exists,
            path: result.path || null
        };
    }
    catch (error) {
        console.error(`Failed to check command ${command}:`, error);
        return { available: false, path: null };
    }
}
/**
 * Clear the cached PATH (useful after installing new tools)
 */
export async function clearTerminalPathCache() {
    try {
        await ShellService.clearPathCache();
        return true;
    }
    catch (error) {
        console.error('Failed to clear PATH cache:', error);
        return false;
    }
}
/**
 * Debug helper to check common developer tools
 */
export async function checkDeveloperTools() {
    const tools = [
        'claude',
        'git',
        'node',
        'npm',
        'python',
        'python3',
        'code',
        'docker',
        'kubectl',
        'aws',
        'gh',
        'cargo',
        'go',
        'java',
        'ruby',
        'php',
        'perl',
        'swift',
        'dotnet'
    ];
    const results = {};
    for (const tool of tools) {
        results[tool] = await checkCommandAvailability(tool);
    }
    return results;
}
/**
 * Log available developer tools to console (useful for debugging)
 */
export async function logAvailableTools() {
    console.group('🔧 Developer Tools Availability');
    const tools = await checkDeveloperTools();
    const available = Object.entries(tools)
        .filter(([_, info]) => info.available)
        .map(([name, info]) => ({ name, path: info.path }));
    const unavailable = Object.entries(tools)
        .filter(([_, info]) => !info.available)
        .map(([name]) => name);
    console.table(available);
    if (unavailable.length > 0) {
        console.log('❌ Unavailable:', unavailable.join(', '));
    }
    console.groupEnd();
}
