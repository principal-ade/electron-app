import { FileSystemService } from '../main-process-api/FileSystemService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { GitService } from '../main-process-api/GitService';

export const SAMPLE_TYPESCRIPT = `export interface Topic {
  id: string;
  title: string;
  description?: string;
  updatedAt: string;
}

export function searchTopics(topics: Topic[], query: string): Topic[] {
  const normalized = query.trim().toLowerCase();

  return topics
    .filter((topic) => {
      if (!normalized) return true;

      return [topic.title, topic.description ?? '']
        .some((text) => text.toLowerCase().includes(normalized));
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function displayTitle(topic: Topic): string {
  return topic.title.trim() || 'Untitled topic';
}
`;

const FILES: Record<string, string> = {
  '/storybook/searchTopics.ts': SAMPLE_TYPESCRIPT,
  '/storybook/longFile.ts': Array.from(
    { length: 80 },
    (_, index) => `/** Example section ${index + 1}. */
export function section${index + 1}(value: number): number {
  return value + ${index + 1};
}
`,
  ).join('\n'),
  '/storybook/empty.ts': '',
};

/** Scoped, in-memory file reads shared by both file-tab stories. */
export function installFileTabMocks() {
  const originalPreferences = UserPreferencesService.getPreferences;
  const originalRepositoryInfo = GitService.getRepositoryInfo;
  GitService.getRepositoryInfo = async (filePath) =>
    filePath.startsWith('/storybook/')
      ? {
          isRepository: true,
          root: '/storybook',
          remotes: [
            {
              name: 'origin',
              url: 'https://github.com/principal-ade/electron-app.git',
              owner: 'principal-ade',
              repo: 'electron-app',
            },
          ],
        }
      : null;
  UserPreferencesService.getPreferences = async () => ({
    enableVimMode: false,
  });
  const original = {
    readFile: FileSystemService.readFile,
    getFileStats: FileSystemService.getFileStats,
    writeFile: FileSystemService.writeFile,
    watchFile: FileSystemService.watchFile,
    stopWatchingFile: FileSystemService.stopWatchingFile,
    onFileChange: FileSystemService.onFileChange,
  };
  const files = { ...FILES };
  FileSystemService.readFile = async (filePath) => {
    if (filePath === '/storybook/loading.ts') {
      return new Promise<Awaited<ReturnType<typeof original.readFile>>>(
        () => {},
      );
    }
    if (filePath === '/storybook/unreadable.ts') {
      throw new Error('Permission denied: this sample file cannot be read.');
    }
    if (!Object.prototype.hasOwnProperty.call(files, filePath)) return null;
    return { filePath, content: files[filePath] };
  };
  FileSystemService.getFileStats = async () => ({
    size: 0,
    isDirectory: false,
    lastModified: new Date(0),
    writable: false,
  });
  FileSystemService.writeFile = async (filePath, content) => {
    files[filePath] = content;
    return { success: true, filePath };
  };
  FileSystemService.watchFile = async () => true;
  FileSystemService.stopWatchingFile = async () => true;
  FileSystemService.onFileChange = () => () => {};
  return () => {
    Object.assign(FileSystemService, original);
    UserPreferencesService.getPreferences = originalPreferences;
    GitService.getRepositoryInfo = originalRepositoryInfo;
  };
}

/** Same fake filesystem, but a proven writable local working copy. */
export function installEditableFileTabMocks() {
  const restore = installFileTabMocks();
  FileSystemService.getFileStats = async () => ({
    size: 0,
    isDirectory: false,
    lastModified: new Date(0),
    writable: true,
  });
  return restore;
}
