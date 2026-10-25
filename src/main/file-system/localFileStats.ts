import { constants, promises as fs } from 'fs';
import path from 'path';
import type { FileStats } from '../../shared/main-process-api-interfaces/FileSystemAPI';

/** Check the current process's access, not just the file's Unix mode bits. */
export async function getLocalFileStats(filePath: string): Promise<FileStats> {
  const stats = await fs.stat(filePath);
  const writable =
    path.isAbsolute(filePath) &&
    stats.isFile() &&
    (await fs.access(filePath, constants.W_OK).then(
      () => true,
      () => false,
    ));
  return {
    size: stats.size,
    isDirectory: stats.isDirectory(),
    lastModified: stats.mtime,
    writable,
  };
}
