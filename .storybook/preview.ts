import type { Preview } from '@storybook/react-webpack5';

// Mock window.electron and window.mainProcess for Storybook to prevent errors
if (typeof window !== 'undefined') {
  // Mock window.electron
  if (!window.electron) {
    (window as any).electron = {
      // TIPC clients (alexandriaClient, terminalClient, githubClient, …) all
      // go through window.electron.ipcRenderer.invoke. In Storybook there's
      // no preload, so resolve every channel to undefined and treat `on`
      // subscriptions as no-ops returning an unsubscribe function.
      ipcRenderer: {
        invoke: (..._args: unknown[]) => Promise.resolve(undefined),
        on: (..._args: unknown[]) => () => {},
        off: (..._args: unknown[]) => {},
        send: (..._args: unknown[]) => {},
        removeListener: (..._args: unknown[]) => {},
        removeAllListeners: (..._args: unknown[]) => {},
      },
      // Terminal helpers consumed directly off window.electron by
      // terminalClient — keep them as no-op subscriptions/Promises.
      onTerminalData: () => () => {},
      onOwnershipLost: () => () => {},
      onPortReady: () => () => {},
      writeToTerminalPort: () => Promise.resolve(),
      hasTerminalPort: () => Promise.resolve(false),
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
        // AlexandriaService.getRepositories() goes through tipc, so it lands
        // on ipcRenderer.invoke above and doesn't need an entry here. Listed
        // for completeness in case anything calls it directly.
        getRepositories: () => Promise.resolve([]),
        registerRepository: (_repoPath: string) =>
          Promise.resolve({ path: _repoPath, name: 'mock' }),
        getRepositoryByPath: (_repoPath: string) => Promise.resolve(null),
      },
      // Skill lock surface — the skill browser reads the lock file to gate the
      // install screen vs the post-install landing.
      skillLock: {
        getSkillLock: () => Promise.resolve(null),
        onSkillInstalled: (_cb: any) => () => {},
        onSkillUninstalled: (_cb: any) => () => {},
        onSkillUpdated: (_cb: any) => () => {},
      },
      // Github + git + shell — only invoked from user-driven actions
      // (Install Skills, Add Project). Provide enough so
      // the buttons don't blow up if a story driver clicks them.
      github: {
        getTree: () =>
          Promise.resolve({ success: false, data: null, error: 'storybook' }),
        installSkill: () =>
          Promise.resolve({ success: false, error: 'storybook' }),
      },
      git: {
        execCommand: () => Promise.resolve({ stdout: '', stderr: '', code: 0 }),
        scanFolderForRepos: () => Promise.resolve([]),
      },
      fileSystem: {
        // FileSystemService.selectDirectory call — return a cancelled pick so
        // the Add Project handler short-circuits.
        selectDirectory: () =>
          Promise.resolve({ canceled: true, filePaths: [] }),
        readFile: (path: string) =>
          Promise.resolve({ content: `Mock content for ${path}` }),
        writeFile: () => Promise.resolve({ success: true }),
        readDirectory: () => Promise.resolve([]),
        getFileStats: () =>
          Promise.resolve({
            isFile: true,
            isDirectory: false,
            size: 0,
            modified: new Date().toISOString(),
          }),
        deleteFile: () => Promise.resolve({ success: true }),
        watchFile: () => Promise.resolve({ unsubscribe: () => {} }),
        onFileChange: () => ({ unsubscribe: () => {} }),
      },
      // ShellService.openExternal — quietly succeed in storybook.
      shell: {
        openExternal: () => Promise.resolve({ success: true }),
      },
      // Catch-all stub for the terminal IPC namespace TerminalService talks to.
      // Returns shapes minimal enough that TerminalProvider's effects can
      // run their early-returns without throwing.
      terminal: {
        list: () => Promise.resolve([]),
        onExit: () => () => {},
        onDataForSession: () => () => {},
        write: () => {},
        resize: () => {},
        destroy: () => Promise.resolve(),
        createWithCommand: () => Promise.resolve('mock-session'),
        getOrCreate: () => Promise.resolve('mock-session'),
        checkOwnership: () => Promise.resolve({ owned: false }),
        claimOwnership: () => Promise.resolve({ success: false }),
        releaseOwnership: () => Promise.resolve(),
        onOwnershipLost: () => () => {},
        refresh: () => Promise.resolve(),
        requestDataPort: () => Promise.resolve(),
        onPortReady: () => () => {},
      },
      // WindowService.openDevWorkspace — no-op in storybook.
      window: {
        openDevWorkspace: () => Promise.resolve({ success: true }),
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