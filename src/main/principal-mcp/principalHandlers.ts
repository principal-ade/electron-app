import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SlideDocument {
  filePath: string;
  content: string;
  slides: string[];
  currentSlide: number;
  metadata: {
    title?: string;
    lastModified?: Date;
    totalSlides?: number;
  };
}

// Simple IPC handlers for principal MCP operations
export function registerPrincipalHandlers() {
  // Load or create principal document
  ipcMain.handle('principal:load-document', async (event, filePath: string) => {
    try {
      let content = '';
      let exists = false;

      try {
        content = await fs.readFile(filePath, 'utf-8');
        exists = true;
      } catch (err) {
        // File doesn't exist, return null to let renderer create default
        return null;
      }

      const slides = content
        .split(/\n---\n/)
        .filter((slide) => slide.trim().length > 0);

      return {
        filePath,
        content,
        slides,
        currentSlide: 0,
        metadata: {
          title: path.basename(filePath, '.md'),
          lastModified: exists ? new Date() : undefined,
          totalSlides: slides.length,
        },
      } as SlideDocument;
    } catch (error) {
      console.error('[Principal] Error loading document:', error);
      throw error;
    }
  });

  // Save principal document
  ipcMain.handle(
    'principal:save-document',
    async (event, filePath: string, content: string) => {
      try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Save to file
        await fs.writeFile(filePath, content, 'utf-8');

        return { success: true };
      } catch (error) {
        console.error('[Principal] Error saving document:', error);
        return { success: false, error: (error as Error).message };
      }
    },
  );
}