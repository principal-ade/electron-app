/**
 * Repository Core - Shared implementations for repository operations
 * These modules can be used by both main process and utility processes
 * They only use Node.js built-in APIs and npm packages, no Electron dependencies
 */

export {
  FileSystemCore,
  type FileSystemCoreOptions,
  type FileStats,
  type FileTreeResult,
} from './FileSystemCore';
export { GitCore, type GitInfo } from './GitCore';
