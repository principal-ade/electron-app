/**
 * electron-cli-bridge
 * A robust solution for executing CLI commands in Electron applications
 * Solves EBADF errors by using utilityProcess instead of child_process
 */

export { ElectronCLI, electronCLI } from './ElectronCLI';
export { CLIBridge } from './CLIBridge';
export { GitExecutor } from './executors/GitExecutor';
export type { GitStatus, GitRemote, GitDiffStats } from './executors/GitExecutor';
export * from './types';

// Quick start example:
// import { electronCLI } from 'electron-cli-bridge';
// 
// app.whenReady().then(async () => {
//   await electronCLI.initialize();
//   const branch = await electronCLI.git.getCurrentBranch('/path/to/repo');
//   console.log(branch);
// });