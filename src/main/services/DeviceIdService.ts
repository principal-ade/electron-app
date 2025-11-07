/**
 * DeviceIdService - Manages persistent device ID for presence tracking
 *
 * This service generates a stable device ID on first run and persists it
 * to disk, ensuring the same device ID is used across app restarts.
 * This is critical for multi-device presence tracking in the traffic controller.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface DeviceIdData {
  deviceId: string;
  createdAt: number;
  platform: string;
  hostname?: string;
}

export class DeviceIdService {
  private static instance: DeviceIdService;
  private deviceIdFilePath: string;
  private deviceId: string | null = null;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.deviceIdFilePath = path.join(userDataPath, 'device-id.json');
  }

  static getInstance(): DeviceIdService {
    if (!DeviceIdService.instance) {
      DeviceIdService.instance = new DeviceIdService();
    }
    return DeviceIdService.instance;
  }

  /**
   * Get or create the device ID
   * This is the main method to use - it ensures a stable device ID across restarts
   */
  async getDeviceId(): Promise<string> {
    // Return cached ID if available
    if (this.deviceId) {
      return this.deviceId;
    }

    // Try to load from disk
    try {
      if (fs.existsSync(this.deviceIdFilePath)) {
        const data = await fs.promises.readFile(this.deviceIdFilePath, 'utf-8');
        const parsed = JSON.parse(data) as DeviceIdData;

        if (parsed.deviceId && typeof parsed.deviceId === 'string') {
          this.deviceId = parsed.deviceId;
          console.log('[DeviceIdService] Loaded existing device ID:', this.deviceId);
          return this.deviceId;
        }
      }
    } catch (error) {
      console.error('[DeviceIdService] Failed to load device ID from disk:', error);
      // Continue to create a new ID
    }

    // Generate new device ID
    return this.createNewDeviceId();
  }

  /**
   * Create and persist a new device ID
   */
  private async createNewDeviceId(): Promise<string> {
    try {
      // Generate UUID v4
      const newDeviceId = `electron-${uuidv4()}`;

      // Get hostname (best effort)
      let hostname = 'unknown';
      try {
        const os = await import('os');
        hostname = os.hostname();
      } catch {
        // Ignore if hostname retrieval fails
      }

      // Create device data
      const deviceData: DeviceIdData = {
        deviceId: newDeviceId,
        createdAt: Date.now(),
        platform: process.platform,
        hostname,
      };

      // Ensure directory exists
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }

      // Write to disk
      await fs.promises.writeFile(
        this.deviceIdFilePath,
        JSON.stringify(deviceData, null, 2),
        'utf-8'
      );

      this.deviceId = newDeviceId;
      console.log('[DeviceIdService] Created new device ID:', this.deviceId);
      return this.deviceId;
    } catch (error) {
      console.error('[DeviceIdService] Failed to create device ID:', error);

      // Fallback: generate temporary ID (not persisted)
      const fallbackId = `electron-${uuidv4()}`;
      console.warn('[DeviceIdService] Using temporary device ID (not persisted):', fallbackId);
      return fallbackId;
    }
  }

  /**
   * Reset device ID (useful for testing or troubleshooting)
   */
  async resetDeviceId(): Promise<string> {
    try {
      // Delete existing file
      if (fs.existsSync(this.deviceIdFilePath)) {
        await fs.promises.unlink(this.deviceIdFilePath);
        console.log('[DeviceIdService] Deleted existing device ID file');
      }

      // Clear cache
      this.deviceId = null;

      // Create new ID
      return this.createNewDeviceId();
    } catch (error) {
      console.error('[DeviceIdService] Failed to reset device ID:', error);
      throw error;
    }
  }

  /**
   * Get device info (for debugging)
   */
  async getDeviceInfo(): Promise<DeviceIdData | null> {
    try {
      if (fs.existsSync(this.deviceIdFilePath)) {
        const data = await fs.promises.readFile(this.deviceIdFilePath, 'utf-8');
        return JSON.parse(data) as DeviceIdData;
      }
      return null;
    } catch (error) {
      console.error('[DeviceIdService] Failed to get device info:', error);
      return null;
    }
  }
}

// Export singleton instance
export const deviceIdService = DeviceIdService.getInstance();
