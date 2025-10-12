import { ipcMain } from 'electron';
import { dockerService } from '../../../docker/dockerService';

export function registerDockerHandlers() {
  console.log('[DockerHandlers] Registering Docker IPC handlers...');

  // Check Docker status
  ipcMain.handle('docker:check-status', async () => {
    console.log('[DockerHandlers] docker:check-status called');
    try {
      console.log('[DockerHandlers] Checking Docker status...');
      const status = await dockerService.checkDockerStatus();
      console.log('[DockerHandlers] Docker status result:', status);
      return { success: true, data: status };
    } catch (error) {
      console.error('[DockerHandlers] Error checking Docker status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Pull Docker image
  ipcMain.handle('docker:pull-image', async (event, imageName: string) => {
    try {
      const result = await dockerService.pullDockerImage(
        imageName,
        (message) => {
          // Send progress updates to renderer
          event.sender.send('docker:pull-progress', { imageName, message });
        },
      );
      return { success: result };
    } catch (error) {
      console.error('Error pulling Docker image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Check if Knip image exists
  ipcMain.handle('docker:has-knip-image', async () => {
    try {
      const hasImage = await dockerService.hasKnipImage();
      return { success: true, hasImage };
    } catch (error) {
      console.error('Error checking Knip image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Run Knip analysis in Docker
  ipcMain.handle(
    'docker:run-knip',
    async (event, projectPath: string, options?: Record<string, unknown>) => {
      try {
        const result = await dockerService.runKnipInDocker(
          projectPath,
          options,
        );
        return { success: true, data: result };
      } catch (error) {
        console.error('Error running Knip in Docker:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Create custom Knip image
  ipcMain.handle('docker:create-knip-image', async () => {
    try {
      const result = await dockerService.createCustomKnipImage();
      return { success: result };
    } catch (error) {
      console.error('Error creating custom Knip image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Start Knip container
  ipcMain.handle(
    'docker:start-knip-container',
    async (event, projectPath: string) => {
      try {
        const containerId = await dockerService.startKnipContainer(projectPath);
        return { success: true, containerId };
      } catch (error) {
        console.error('Error starting Knip container:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Execute command in Knip container
  ipcMain.handle('docker:exec-in-container', async (event, command: string) => {
    try {
      const result = await dockerService.execInKnipContainer(command);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error executing in Knip container:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Stop Knip container
  ipcMain.handle('docker:stop-knip-container', async () => {
    try {
      await dockerService.stopKnipContainer();
      return { success: true };
    } catch (error) {
      console.error('Error stopping Knip container:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get Docker installation instructions
  ipcMain.handle('docker:get-install-instructions', async () => {
    try {
      const instructions = dockerService.getInstallInstructions();
      return { success: true, instructions };
    } catch (error) {
      console.error('Error getting Docker install instructions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
