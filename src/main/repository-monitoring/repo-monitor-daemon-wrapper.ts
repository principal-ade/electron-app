/**
 * Wrapper entry point for the repository monitor daemon.
 * Sets a recognizable process title before loading the actual daemon.
 */

if (typeof process !== 'undefined') {
  process.title = 'Principal Repo Monitor Daemon';
}

// Load the actual daemon
try {
  require('@principal-ai/repository-monitoring-server/dist/daemon/repository-monitoring-daemon.js');
} catch (err) {
  // Fallback: try to require from relative paths
  try {
    const resolved = require.resolve(
      '@principal-ai/repository-monitoring-server/dist/daemon/repository-monitoring-daemon.js'
    );
    require(resolved);
  } catch {
    // Last resort - rethrow
    throw err;
  }
}
