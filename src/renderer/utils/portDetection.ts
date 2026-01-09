/**
 * Port Detection Utility
 *
 * Provides functions for finding available ports for development servers like Storybook.
 */

import { LocalhostDetectionService } from '../main-process-api/LocalhostDetectionService';

/**
 * Find an available port within a given range by checking sequentially.
 *
 * @param startPort - The first port to check (default: 6006)
 * @param endPort - The last port to check (default: 6020)
 * @returns Promise that resolves to an available port number
 * @throws Error if all ports in the range are busy
 *
 * @example
 * // Find available port for Storybook (tries 6006, 6007, 6008, ...)
 * const port = await findAvailablePort(6006, 6020);
 * console.log(`Found available port: ${port}`);
 */
export async function findAvailablePort(
  startPort: number = 6006,
  endPort: number = 6020,
): Promise<number> {
  // Validate port range
  if (startPort < 1 || startPort > 65535) {
    throw new Error(`Invalid startPort: ${startPort}. Must be between 1 and 65535.`);
  }
  if (endPort < 1 || endPort > 65535) {
    throw new Error(`Invalid endPort: ${endPort}. Must be between 1 and 65535.`);
  }
  if (startPort > endPort) {
    throw new Error(`startPort (${startPort}) cannot be greater than endPort (${endPort})`);
  }

  // Get currently running servers to check which ports are occupied
  const scanResult = await LocalhostDetectionService.detectRunningServers();
  const occupiedPorts = new Set(scanResult.servers.map((server) => server.port));

  // Try each port in sequence
  for (let port = startPort; port <= endPort; port++) {
    // Skip if we know this port is occupied
    if (occupiedPorts.has(port)) {
      console.log(`[portDetection] Port ${port} is occupied by running server`);
      continue;
    }

    // Double-check with a direct port check
    try {
      const isAvailable = await LocalhostDetectionService.checkPort(port, 500);
      if (!isAvailable) {
        console.log(`[portDetection] Port ${port} is available`);
        return port;
      }
      console.log(`[portDetection] Port ${port} is occupied (check returned true)`);
    } catch (error) {
      console.error(`[portDetection] Error checking port ${port}:`, error);
      // Continue to next port on error
    }
  }

  // All ports in range are busy
  throw new Error(
    `All ports in range ${startPort}-${endPort} are busy. Please close some dev servers and try again.`,
  );
}

/**
 * Wait for a port to become responsive by polling with a timeout.
 *
 * @param port - The port number to check
 * @param timeout - Maximum time to wait in milliseconds (default: 30000ms = 30s)
 * @param interval - Poll interval in milliseconds (default: 1000ms = 1s)
 * @returns Promise that resolves to true when port is responsive
 * @throws Error if timeout is reached before port becomes responsive
 *
 * @example
 * // Wait for Storybook to start on port 6006
 * await waitForPortReady(6006, 30000);
 * console.log('Storybook is ready!');
 */
export async function waitForPortReady(
  port: number,
  timeout: number = 30000,
  interval: number = 1000,
): Promise<boolean> {
  const startTime = Date.now();
  let attempts = 0;

  console.log(`[portDetection] Waiting for port ${port} to become responsive (timeout: ${timeout}ms)`);

  while (Date.now() - startTime < timeout) {
    attempts++;
    try {
      const isResponsive = await LocalhostDetectionService.checkPort(port, 500);
      if (isResponsive) {
        console.log(`[portDetection] ✅ Port ${port} is now responsive (took ${Date.now() - startTime}ms, ${attempts} attempts)`);
        return true;
      }

      // Log progress every 5 attempts (5 seconds)
      if (attempts % 5 === 0) {
        console.log(`[portDetection] Still waiting for port ${port}... (${Date.now() - startTime}ms elapsed)`);
      }
    } catch (error) {
      console.warn(`[portDetection] Port check attempt ${attempts} failed:`, error);
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  console.error(`[portDetection] ❌ Port ${port} did not become responsive after ${attempts} attempts over ${timeout}ms`);
  throw new Error(
    `Port ${port} did not become responsive within ${timeout}ms. The server may have failed to start. Check the terminal output for errors.`,
  );
}
