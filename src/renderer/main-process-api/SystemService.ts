// Safe window API access utilities for System

import type { 
  CommandOptions, 
  CommandResult, 
  DialogOptions, 
  DialogResult, 
  UpdateCheckResult 
} from '../../shared/main-process-api-interfaces/SystemAPI';

export class SystemService {
  static async getPlatform(): Promise<string> {
    return window.mainProcess.system.getPlatform();
  }

  static async getSystemInfo(): Promise<{
    totalMemory: number;
    freeMemory: number;
    totalDisk: number;
    freeDisk: number;
    platform: string;
    arch: string;
    cpus: number;
    osVersion: string;
  } | null> {
    return window.mainProcess.system.getSystemInfo();
  }

  static async executeCommand(options: CommandOptions): Promise<CommandResult> {
    return window.mainProcess.system.executeCommand(options);
  }

  static async openDialog(options: DialogOptions): Promise<DialogResult> {
    return window.mainProcess.system.openDialog(options);
  }

  static async checkForUpdateManually(): Promise<UpdateCheckResult> {
    return window.mainProcess.system.checkForUpdateManually();
  }

  static async restartApp(): Promise<void> {
    return window.mainProcess.system.restartApp();
  }
}