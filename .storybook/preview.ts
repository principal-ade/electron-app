import type { Preview } from '@storybook/react-webpack5';

// Mock window.electron and window.mainProcess for Storybook to prevent errors
if (typeof window !== 'undefined') {
  // Mock window.electron
  if (!window.electron) {
    (window as any).electron = {
      repositoryMonitoring: {
        onGitStatusChanged: () => ({ unsubscribe: () => {} }),
        onFileSystemChanged: () => ({ unsubscribe: () => {} }),
        onBranchStatusChanged: () => ({ unsubscribe: () => {} }),
        getGitStatus: () => Promise.resolve(null),
        refreshGitStatus: () => Promise.resolve(),
        getBranchStatus: () => Promise.resolve(null),
      },
      fileSystem: {
        readFile: (path: string) => Promise.resolve({ content: `Mock content for ${path}` }),
        writeFile: (path: string, content: string) => Promise.resolve({ success: true }),
        readDirectory: (path: string) => Promise.resolve([]),
        exists: (path: string) => Promise.resolve(true),
        getFileTree: () => Promise.resolve(null),
      },
      package: {
        getPackageInfo: () => Promise.resolve(null),
        getPackages: () => Promise.resolve([]),
      },
      alexandria: {
        getRepository: () => Promise.resolve(null),
        getAllRepositories: () => Promise.resolve([]),
      },
      markdown: {
        getMarkdownFiles: () => Promise.resolve([]),
      },
      quality: {
        getQualityMetrics: () => Promise.resolve(null),
      },
    } as any;
  }

  // Mock window.mainProcess for FileSystemService and RepositoryMonitoringService
  if (!window.mainProcess) {
    (window as any).mainProcess = {
      fileSystem: {
        readFile: (path: string) => {
          // Special handling for different file types
          if (path.includes('.md') || path.includes('.mdx')) {
            return Promise.resolve({
              content: `# Mock Markdown Content

This is mock content for ${path} in Storybook.

## Features
- Markdown editing
- Syntax highlighting
- Live preview

\`\`\`javascript
// Sample code
const example = "Hello from Storybook!";
console.log(example);
\`\`\`
`,
            });
          }
          return Promise.resolve({ content: `Mock content for ${path}` });
        },
        writeFile: (path: string, content: string) => {
          console.log('[Storybook Mock] Writing file:', path, 'content length:', content.length);
          return Promise.resolve({ success: true });
        },
        readDirectory: (path: string) => Promise.resolve([]),
        getFileStats: (path: string) => Promise.resolve({
          isFile: true,
          isDirectory: false,
          size: 1024,
          modified: new Date().toISOString()
        }),
        deleteFile: (path: string) => Promise.resolve({ success: true }),
        watchFile: (path: string) => Promise.resolve({ unsubscribe: () => {} }),
        onFileChange: (callback: any) => ({ unsubscribe: () => {} }),
      },
      repositoryMonitoring: {
        onGitStatusChanged: (callback: any) => {
          // Return a mock unsubscribe function
          return () => {};
        },
        onFileSystemChanged: (callback: any) => {
          return () => {};
        },
        onBranchStatusChanged: (callback: any) => {
          return () => {};
        },
        onCacheSync: (callback: any) => {
          return () => {};
        },
        getGitStatus: (repoPath: string) => Promise.resolve(null),
        refreshGitStatus: (repoPath: string) => Promise.resolve(),
        getBranchStatus: (repoPath: string) => Promise.resolve(null),
        getFileTree: (repoPath: string) => Promise.resolve(null),
        getPackages: (repoPath: string) => Promise.resolve(null),
        getRepositoryCacheSnapshot: (repoPath: string) => Promise.resolve({ repoPath, slices: {} }),
        registerRepository: (repoPath: string) => Promise.resolve({ success: true }),
        unregisterRepository: (repoPath: string) => Promise.resolve({ success: true }),
        getMonitoringStatus: () => Promise.resolve({ isMonitoring: false, repositories: [] }),
        executeTool: (request: any) => Promise.resolve({ success: true, result: {} }),
        getMarkdownFiles: (repoPath: string) => Promise.resolve([]),
        getQualityMetrics: (repoPath: string) => Promise.resolve(null),
      },
      alexandria: {
        onRepositoryChange: (callback: any) => {
          // Return a mock unsubscribe function
          return () => {};
        },
        getRepository: (repoPath: string) => Promise.resolve(null),
        getAllRepositories: () => Promise.resolve([]),
        addRepository: (repo: any) => Promise.resolve({ success: true }),
        removeRepository: (repoPath: string) => Promise.resolve({ success: true }),
        updateRepository: (repo: any) => Promise.resolve({ success: true }),
      },
      markdown: {
        getMarkdownFiles: (repoPath: string) => Promise.resolve([]),
        onMarkdownFilesChanged: (callback: any) => {
          return () => {};
        },
      },
      quality: {
        getQualityMetrics: (repoPath: string) => Promise.resolve(null),
        onQualityMetricsChanged: (callback: any) => {
          return () => {};
        },
      },
    } as any;
  }
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;