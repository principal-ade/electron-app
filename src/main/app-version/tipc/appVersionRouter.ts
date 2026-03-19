/**
 * TIPC Router for App Version Operations
 *
 * Type-safe RPC for app version and update operations.
 * Replaces the legacy ipcMain.on/handle pattern.
 */

import { tipc } from '@egoist/tipc/main';
import { app } from 'electron';
import type { CheckForUpdateInput } from '../../../shared/tipc/appVersionRouterTypes';
import { getAppVersionManagerInstance } from '../appVersionManagerSingleton';

const t = tipc.create();

export const appVersionRouter = {
  // ===========================================================================
  // Version Info
  // ===========================================================================

  getVersion: t.procedure.action(async () => {
    return app.getVersion();
  }),

  getVersionInfo: t.procedure.action(async () => {
    return {
      version: app.getVersion(),
      isDevMode: !app.isPackaged,
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
    };
  }),

  isDevMode: t.procedure.action(async () => {
    return !app.isPackaged;
  }),

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  checkForUpdate: t.procedure
    .input<CheckForUpdateInput>()
    .action(async ({ input }) => {
      const manager = getAppVersionManagerInstance();
      manager.checkForUpdate(input.trigger);
      return { started: true };
    }),

  downloadUpdate: t.procedure.action(async () => {
    const manager = getAppVersionManagerInstance();
    manager.downloadUpdate();
    return { started: true };
  }),

  installUpdate: t.procedure.action(async () => {
    const manager = getAppVersionManagerInstance();
    manager.installUpdate();
    return { started: true };
  }),

  testDownloadUpdate: t.procedure.action(async () => {
    const manager = getAppVersionManagerInstance();
    await manager.testDownloadUpdate();
    return { started: true };
  }),

  testGoodbyeScreen: t.procedure.action(async () => {
    const manager = getAppVersionManagerInstance();
    manager.testGoodbyeScreen();
    return { started: true };
  }),
};

export type AppVersionRouter = typeof appVersionRouter;
