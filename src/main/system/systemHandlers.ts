import { ipcMain, dialog, app } from 'electron';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { electronCLI } from '../electron-cli-bridge';
import { 
  SystemEvents, 
  CommandOptions, 
  CommandResult, 
  DialogOptions, 
  DialogResult,
  UpdateCheckResult
} from '../../shared/main-process-api-interfaces/SystemAPI';
import { applicationWindows } from '../window/modernWindowManager';

const execAsync = promisify(exec);

export function registerSystemHandlers() {
  ipcMain.handle(SystemEvents.GET_PLATFORM, async () => {
    return process.platform;
  });

  ipcMain.handle(SystemEvents.GET_SYSTEM_INFO, async () => {
    try {
      // Get basic system information
      const totalMemoryBytes = os.totalmem();
      const freeMemoryBytes = os.freemem();

      console.log('Memory info:', {
        totalBytes: totalMemoryBytes,
        freeBytes: freeMemoryBytes,
        totalGB: totalMemoryBytes / (1024 * 1024 * 1024),
        freeGB: freeMemoryBytes / (1024 * 1024 * 1024),
      });

      // Round to nearest integer for cleaner display
      const totalMemoryGB = Math.round(totalMemoryBytes / (1024 * 1024 * 1024));
      const freeMemoryGB = Math.round(freeMemoryBytes / (1024 * 1024 * 1024));

      // Get disk space - this is platform specific
      const diskInfo = { total: 0, free: 0 };

      if (process.platform === 'darwin') {
        try {
          // Use df without -BG flag and parse the output in KB
          const { stdout } = await execAsync('df -k / | tail -1');
          console.log('df output:', stdout);
          const parts = stdout.trim().split(/\s+/);
          // df -k output format: Filesystem 1024-blocks Used Available Capacity Mounted
          const totalKB = parseInt(parts[1]) || 0;
          const availableKB = parseInt(parts[3]) || 0;
          diskInfo.total = Math.round(totalKB / (1024 * 1024)); // Convert KB to GB
          diskInfo.free = Math.round(availableKB / (1024 * 1024)); // Convert KB to GB
          console.log('Disk info:', diskInfo);
        } catch (error) {
          console.error('Error getting disk info:', error);
        }
      } else if (process.platform === 'linux') {
        try {
          const { stdout } = await execAsync('df -BG / | tail -1');
          const parts = stdout.trim().split(/\s+/);
          // df output format: Filesystem 1G-blocks Used Available Use% Mounted
          diskInfo.total = parseInt(parts[1]) || 0;
          diskInfo.free = parseInt(parts[3]) || 0;
        } catch (error) {
          console.error('Error getting disk info:', error);
        }
      } else if (process.platform === 'win32') {
        try {
          const { stdout } = await execAsync(
            'wmic logicaldisk get size,freespace,caption',
          );
          const lines = stdout
            .trim()
            .split('\n')
            .filter((line) => line.includes('C:'));
          if (lines.length > 0) {
            const parts = lines[0].trim().split(/\s+/);
            diskInfo.free =
              Math.round(parseInt(parts[1]) / (1024 * 1024 * 1024)) || 0;
            diskInfo.total =
              Math.round(parseInt(parts[2]) / (1024 * 1024 * 1024)) || 0;
          }
        } catch (error) {
          console.error('Error getting disk info:', error);
        }
      }

      const result = {
        totalMemory: totalMemoryGB,
        freeMemory: freeMemoryGB,
        totalDisk: diskInfo.total,
        freeDisk: diskInfo.free,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        osVersion: os.release(),
      };

      console.log('System info result:', result);
      return result;
    } catch (error) {
      console.error('Error getting system info:', error);
      throw error;
    }
  });

  // Execute command handler (replaces execute-command)
  ipcMain.handle(SystemEvents.EXECUTE_COMMAND, async (_, options: CommandOptions): Promise<CommandResult> => {
    try {
      // Ensure CLI is initialized
      await electronCLI.initialize();
      
      // Execute command using electron-cli-bridge
      const result = await electronCLI.execute(options.command, options.args || [], {
        cwd: options.cwd,
        env: Object.fromEntries(
          Object.entries({ ...process.env, ...(options.env || {}) })
            .filter(([_, v]) => v !== undefined)
        ) as Record<string, string>,
        timeout: options.timeout
      });
      
      return {
        success: result.success,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        code: result.exitCode
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        code: -1,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Open dialog handler (replaces dialog:open)
  ipcMain.handle(SystemEvents.OPEN_DIALOG, async (_, options: DialogOptions): Promise<DialogResult> => {
    const windows = Array.from(applicationWindows.values());
    const mainWindow = windows[0]?.window;
    
    if (!mainWindow) {
      return { canceled: true, filePaths: [] };
    }

    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: options.properties || ['openFile'],
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        filters: options.filters
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths
      };
    } catch (error) {
      console.error('Error opening dialog:', error);
      return { canceled: true, filePaths: [] };
    }
  });

  // Check for update manually handler (replaces check-for-update-manually)
  ipcMain.handle(SystemEvents.CHECK_FOR_UPDATE_MANUALLY, async (): Promise<UpdateCheckResult> => {
    try {
      // TODO: Implement actual update checking logic
      // This is a placeholder implementation
      console.log('Checking for updates manually...');
      
      // Emit the completion event for backward compatibility
      const windows = Array.from(applicationWindows.values());
      const mainWindow = windows[0]?.window;
      if (mainWindow) {
        mainWindow.webContents.send('update-check-complete', {
          success: true,
          updateAvailable: false
        });
      }
      
      return {
        success: true,
        updateAvailable: false
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return {
        success: false,
        updateAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Restart app handler (replaces restart-app)
  ipcMain.handle(SystemEvents.RESTART_APP, async (): Promise<void> => {
    try {
      app.relaunch();
      app.quit();
    } catch (error) {
      console.error('Error restarting app:', error);
      throw error;
    }
  });
}
