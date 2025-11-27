/**
 * Utility functions for terminal operations
 *
 * Now uses the unified ShellAPI instead of direct IPC calls.
 */

import { ShellService } from '../main-process-api/ShellService';

/**
 * Check if a command is available in the user's PATH
 */
export async function checkCommandAvailability(command: string): Promise<{
  available: boolean;
  path: string | null;
}> {
  try {
    const result = await ShellService.checkCommand(command);
    return {
      available: result.exists,
      path: result.path || null,
    };
  } catch (error) {
    console.error(`Failed to check command ${command}:`, error);
    return { available: false, path: null };
  }
}

/**
 * Clear the cached PATH (useful after installing new tools)
 */
export async function clearTerminalPathCache(): Promise<boolean> {
  try {
    await ShellService.clearPathCache();
    return true;
  } catch (error) {
    console.error('Failed to clear PATH cache:', error);
    return false;
  }
}

/**
 * Debug helper to check common developer tools
 */
export async function checkDeveloperTools(): Promise<
  Record<string, { available: boolean; path: string | null }>
> {
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
    'dotnet',
  ];

  const results: Record<string, { available: boolean; path: string | null }> =
    {};

  for (const tool of tools) {
    results[tool] = await checkCommandAvailability(tool);
  }

  return results;
}

/**
 * Log available developer tools to console (useful for debugging)
 */
export async function logAvailableTools(): Promise<void> {
  console.info('🔧 Developer Tools Availability');

  const tools = await checkDeveloperTools();

  const available = Object.entries(tools)
    .filter(([_, info]) => info.available)
    .map(([name, info]) => ({ name, path: info.path }));

  const unavailable = Object.entries(tools)
    .filter(([_, info]) => !info.available)
    .map(([name]) => name);

  console.info('Available tools:', available);

  if (unavailable.length > 0) {
    console.info('❌ Unavailable:', unavailable.join(', '));
  }
}
