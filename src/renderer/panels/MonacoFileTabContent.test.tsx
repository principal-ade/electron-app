/// <reference types="jest" />
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MonacoFileTabContent } from './MonacoFileTabContent';
import { HeadlessFileEditorPanel } from './components/HeadlessFileEditorPanel';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { installFileTabMocks, SAMPLE_TYPESCRIPT } from './fileTabStoryFixtures';
import { GitService, type GitInfo } from '../main-process-api/GitService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: { background: '#111111', text: '#ffffff', border: '#444444' },
      fonts: { monospace: 'monospace' },
      fontSizes: [12, 14],
    },
  }),
}));
jest.mock('./components/HeadlessFileEditorPanel', () => ({
  HeadlessFileEditorPanel: jest.fn(() => null),
}));
jest.mock('../main-process-api/GitService', () => ({
  GitService: { getRepositoryInfo: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (GitService.getRepositoryInfo as jest.Mock)
    .mockReset()
    .mockResolvedValue(null);
});

test('shows file identity and reuses the existing Monaco editor', () => {
  render(
    <MonacoFileTabContent
      filePath="/storybook/searchTopics.ts"
      fileName="searchTopics.ts"
    />,
  );
  expect(screen.getByText('/storybook/searchTopics.ts').title).toBe(
    '/storybook/searchTopics.ts',
  );
  const props = (HeadlessFileEditorPanel as jest.Mock).mock.calls[0][0];
  expect(props.filePath).toBe('/storybook/searchTopics.ts');
  expect(props.options.padding).toEqual({ top: 12 });
  // Preserve HeadlessFileEditorPanel's read-only default.
  expect(props.editable).toBeUndefined();
  expect(screen.queryByRole('button', { name: 'Return to span' })).toBeNull();
});

test('wraps long file paths instead of truncating the header', () => {
  const filePath =
    '/projects/long-repository-name/src/renderer/panels/components/HeadlessFileEditorPanel.tsx';
  render(
    <MonacoFileTabContent
      filePath={filePath}
      fileName="HeadlessFileEditorPanel.tsx"
    />,
  );
  const header = screen.getByText(filePath);
  expect(header.title).toBe(filePath);
  expect(header.style.overflowWrap).toBe('anywhere');
  expect(header.style.whiteSpace).not.toBe('nowrap');
  expect(header.style.textOverflow).not.toBe('ellipsis');
});

test('replaces the local root with the origin owner avatar and repository name', async () => {
  (GitService.getRepositoryInfo as jest.Mock).mockResolvedValue({
    isRepository: true,
    root: '/projects/electron-app',
    remotes: [
      {
        name: 'upstream',
        url: 'https://github.com/other/template.git',
        owner: 'other',
        repo: 'template',
      },
      {
        name: 'origin',
        url: 'git@github.com:example/electron-app.git',
        owner: 'example',
        repo: 'electron-app',
      },
    ],
  });
  const filePath = '/projects/electron-app/src/renderer/Editor.tsx';
  render(<MonacoFileTabContent filePath={filePath} fileName="Editor.tsx" />);
  expect(await screen.findByText('src/renderer/Editor.tsx')).toBeTruthy();
  expect(screen.getByText('electron-app').parentElement?.title).toBe(
    'example/electron-app',
  );
  const repositoryLabel = screen.getByText('electron-app');
  expect(repositoryLabel.style.gap).toBe('4px');
  expect(repositoryLabel.parentElement?.style.gap).toBe('8px');
  expect(
    screen.getByText('src/renderer/Editor.tsx').parentElement?.style.gap,
  ).toBe('4px');
  expect(screen.queryByText(filePath)).toBeNull();
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    'https://github.com/example.png?size=40',
  );
  expect(GitService.getRepositoryInfo).toHaveBeenCalledWith(filePath);
  const calls = (HeadlessFileEditorPanel as jest.Mock).mock.calls;
  const props = calls[calls.length - 1][0];
  expect(props.filePath).toBe(filePath);
});

test.each([
  ['/projects/local/', '/projects/local/src/index.ts', 'local'],
  ['C:\\projects\\local', 'C:\\projects\\local\\src\\index.ts', 'local'],
])(
  'uses a local repository name and relative path for %s',
  async (root, filePath, name) => {
    (GitService.getRepositoryInfo as jest.Mock).mockResolvedValue({
      isRepository: true,
      root,
      remotes: [],
    });
    render(<MonacoFileTabContent filePath={filePath} fileName="index.ts" />);
    expect(await screen.findByText('src/index.ts')).toBeTruthy();
    expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  },
);

test('does not mistake a shared directory prefix for the repository root', async () => {
  (GitService.getRepositoryInfo as jest.Mock).mockResolvedValue({
    isRepository: true,
    root: '/projects/app',
    remotes: [],
  });
  const filePath = '/projects/application/index.ts';
  render(<MonacoFileTabContent filePath={filePath} fileName="index.ts" />);
  await act(async () => {});
  expect(screen.getByText(filePath)).toBeTruthy();
  expect(screen.queryByText('app')).toBeNull();
});

test('does not request a GitHub avatar for a different host', async () => {
  (GitService.getRepositoryInfo as jest.Mock).mockResolvedValue({
    isRepository: true,
    root: '/projects/app',
    remotes: [
      {
        name: 'origin',
        url: 'https://gitlab.com/example/app.git',
        owner: 'example',
        repo: 'app',
      },
    ],
  });
  render(
    <MonacoFileTabContent
      filePath="/projects/app/index.ts"
      fileName="index.ts"
    />,
  );
  expect(await screen.findByText('index.ts')).toBeTruthy();
  expect(screen.getByText('app')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
});

test('keeps the file header usable when repository lookup fails', async () => {
  (GitService.getRepositoryInfo as jest.Mock).mockRejectedValue(
    new Error('Unavailable'),
  );
  render(
    <MonacoFileTabContent filePath="/projects/index.ts" fileName="index.ts" />,
  );
  await act(async () => {});
  expect(screen.getByText('/projects/index.ts')).toBeTruthy();
});

test('ignores repository results belonging to a previous file', async () => {
  let resolvePrevious!: (info: GitInfo) => void;
  (GitService.getRepositoryInfo as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise<GitInfo>((resolve) => {
          resolvePrevious = resolve;
        }),
    )
    .mockResolvedValue(null);
  const view = render(
    <MonacoFileTabContent filePath="/old/repo/index.ts" fileName="index.ts" />,
  );
  view.rerender(
    <MonacoFileTabContent filePath="/new/index.ts" fileName="index.ts" />,
  );
  await act(async () => {
    resolvePrevious({ isRepository: true, root: '/old/repo', remotes: [] });
  });
  expect(screen.getByText('/new/index.ts')).toBeTruthy();
  expect(screen.queryByText('repo')).toBeNull();
});

test('forwards edit, Vim, save, and content-loader options', () => {
  const onSave = jest.fn();
  const contentLoader = jest.fn();
  const options = { fontSize: 16 };
  const range = {
    startLineNumber: 10,
    startColumn: 1,
    endLineNumber: 12,
    endColumn: 2,
  };
  render(
    <MonacoFileTabContent
      filePath="/storybook/searchTopics.ts"
      fileName="searchTopics.ts"
      editable
      vimModeOverride
      onSave={onSave}
      contentLoader={contentLoader}
      options={options}
      range={range}
    />,
  );
  const props = (HeadlessFileEditorPanel as jest.Mock).mock.calls[0][0];
  expect(props.editable).toBe(true);
  expect(props.vimModeOverride).toBe(true);
  expect(props.onSave).toBe(onSave);
  expect(props.contentLoader).toBe(contentLoader);
  expect(props.options).toEqual({ ...options, padding: { top: 12 } });
  expect(props.range).toBe(range);
});

test('preserves explicit editor padding overrides', () => {
  render(
    <MonacoFileTabContent
      filePath="/storybook/searchTopics.ts"
      fileName="searchTopics.ts"
      options={{ padding: { top: 20, bottom: 8 } }}
    />,
  );
  const props = (HeadlessFileEditorPanel as jest.Mock).mock.calls[0][0];
  expect(props.options.padding).toEqual({ top: 20, bottom: 8 });
});

test('header button returns to the supplied span without remounting the editor', () => {
  render(
    <MonacoFileTabContent
      filePath="/storybook/longFile.ts"
      fileName="longFile.ts"
      range={{
        startLineNumber: 302,
        startColumn: 1,
        endLineNumber: 304,
        endColumn: 2,
      }}
    />,
  );
  const revealRange = jest.fn();
  const props = (HeadlessFileEditorPanel as jest.Mock).mock.calls[0][0];
  props.ref.current = { revealRange };
  const button = screen.getByRole('button', { name: 'Return to span' });
  expect(button.title).toContain('302–304');
  fireEvent.click(button);
  fireEvent.click(button);
  expect(revealRange).toHaveBeenCalledTimes(2);
  expect(HeadlessFileEditorPanel).toHaveBeenCalledTimes(1);
});

test('both stories use scoped file fixtures and restore file service methods', async () => {
  const original = {
    readFile: FileSystemService.readFile,
    getRepositoryInfo: GitService.getRepositoryInfo,
  };
  const restore = installFileTabMocks();
  try {
    expect(
      await FileSystemService.readFile('/storybook/searchTopics.ts'),
    ).toEqual({
      filePath: '/storybook/searchTopics.ts',
      content: SAMPLE_TYPESCRIPT,
    });
    expect(await FileSystemService.readFile('/storybook/empty.ts')).toEqual({
      filePath: '/storybook/empty.ts',
      content: '',
    });
    expect(
      await FileSystemService.readFile('/storybook/missing.ts'),
    ).toBeNull();
    await expect(
      FileSystemService.readFile('/storybook/unreadable.ts'),
    ).rejects.toThrow('Permission denied');
  } finally {
    restore();
  }
  for (const key of Object.keys(original) as (keyof typeof original)[]) {
    expect(
      key === 'getRepositoryInfo' ? GitService[key] : FileSystemService[key],
    ).toBe(original[key]);
  }
});
