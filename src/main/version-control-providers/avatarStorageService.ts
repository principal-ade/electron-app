import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export class AvatarStorageService {
  private avatarsDir: string;

  constructor() {
    // Store avatars in userData/repository-avatars/
    this.avatarsDir = path.join(app.getPath('userData'), 'repository-avatars');
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.avatarsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create avatars directory:', error);
    }
  }

  /**
   * Generate a hash-based filename for a repository avatar
   */
  private getRepositoryAvatarFilename(remoteUrl: string): string {
    const hash = crypto.createHash('sha256').update(remoteUrl).digest('hex').substring(0, 16);
    return `repo_${hash}.png`;
  }

  /**
   * Generate a hash-based filename for a clone avatar
   */
  private getCloneAvatarFilename(clonePath: string): string {
    const hash = crypto.createHash('sha256').update(clonePath).digest('hex').substring(0, 16);
    return `clone_${hash}.png`;
  }

  /**
   * Save a repository avatar from base64 data
   */
  async saveRepositoryAvatar(remoteUrl: string, imageBase64: string): Promise<{ success: boolean; avatarPath?: string; error?: string }> {
    try {
      const filename = this.getRepositoryAvatarFilename(remoteUrl);
      const filepath = path.join(this.avatarsDir, filename);
      
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(filepath, buffer);
      
      return { success: true, avatarPath: filename };
    } catch (error) {
      console.error('Failed to save repository avatar:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Save a clone avatar from base64 data
   */
  async saveCloneAvatar(clonePath: string, imageBase64: string): Promise<{ success: boolean; avatarPath?: string; error?: string }> {
    try {
      const filename = this.getCloneAvatarFilename(clonePath);
      const filepath = path.join(this.avatarsDir, filename);
      
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(filepath, buffer);
      
      return { success: true, avatarPath: filename };
    } catch (error) {
      console.error('Failed to save clone avatar:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Remove a repository avatar
   */
  async removeRepositoryAvatar(remoteUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filename = this.getRepositoryAvatarFilename(remoteUrl);
      const filepath = path.join(this.avatarsDir, filename);
      
      await fs.unlink(filepath);
      
      return { success: true };
    } catch (error) {
      // File not found is not an error in this case
      if ((error as any).code === 'ENOENT') {
        return { success: true };
      }
      console.error('Failed to remove repository avatar:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Remove a clone avatar
   */
  async removeCloneAvatar(clonePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filename = this.getCloneAvatarFilename(clonePath);
      const filepath = path.join(this.avatarsDir, filename);
      
      await fs.unlink(filepath);
      
      return { success: true };
    } catch (error) {
      // File not found is not an error in this case
      if ((error as any).code === 'ENOENT') {
        return { success: true };
      }
      console.error('Failed to remove clone avatar:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get the full path to an avatar file, or convert to data URL
   */
  async getAvatarUrl(avatarFilename: string): Promise<string | null> {
    try {
      const filepath = path.join(this.avatarsDir, avatarFilename);
      
      // Check if file exists
      await fs.access(filepath);
      
      // Read file and convert to data URL
      const buffer = await fs.readFile(filepath);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      
      return dataUrl;
    } catch (error) {
      console.error('Failed to get avatar URL:', error);
      return null;
    }
  }
}

// Export singleton instance
export const avatarStorageService = new AvatarStorageService();